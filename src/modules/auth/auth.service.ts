import { OAuth2Client } from "google-auth-library";
import { AuthProvider, Role } from "@prisma/client";
import { prisma } from "../../config/db";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { hashPassword, comparePassword, hashToken } from "../../utils/hash";
import { signAccessToken, signRefreshToken, verifyRefreshToken, JwtPayload } from "../../utils/jwt";
import { durationFromNow } from "../../utils/parseDuration";

const googleClient = new OAuth2Client(env.google.clientId);

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** Signs a fresh access+refresh pair and persists a hash of the refresh token. */
async function issueTokens(payload: JwtPayload): Promise<Tokens> {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      userId: payload.id,
      token: hashToken(refreshToken),
      expiresAt: durationFromNow(env.jwt.refreshExpiresIn),
    },
  });

  return { accessToken, refreshToken };
}

function sanitizeUser<T extends { password: string | null }>(user: T) {
  const { password, ...rest } = user;
  return rest;
}

// ------------------------------------------------------------------
// Register: Donor
// ------------------------------------------------------------------
export async function registerDonor(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  bloodGroup: string;
  dateOfBirth: Date;
  gender: string;
  weightKg: number;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { phone: input.phone }], deletedAt: null },
  });
  if (existing) throw ApiError.conflict("Email or phone already registered");

  const hashedPassword = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: hashedPassword,
        role: Role.DONOR,
        provider: AuthProvider.LOCAL,
      },
    });

    await tx.donorProfile.create({
      data: {
        userId: createdUser.id,
        bloodGroup: input.bloodGroup as never,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender as never,
        weightKg: input.weightKg,
        address: input.address,
        city: input.city,
        latitude: input.latitude,
        longitude: input.longitude,
      },
    });

    return createdUser;
  });

  const tokens = await issueTokens({ id: user.id, email: user.email, role: user.role });
  return { user: sanitizeUser(user), tokens };
}

// ------------------------------------------------------------------
// Register: Hospital  (account created unverified — Admin must verify)
// ------------------------------------------------------------------
export async function registerHospital(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  hospitalName: string;
  registrationNumber: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { phone: input.phone }], deletedAt: null },
  });
  if (existing) throw ApiError.conflict("Email or phone already registered");

  const existingReg = await prisma.hospitalProfile.findUnique({
    where: { registrationNumber: input.registrationNumber },
  });
  if (existingReg) throw ApiError.conflict("Hospital registration number already in use");

  const hashedPassword = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: hashedPassword,
        role: Role.HOSPITAL,
        provider: AuthProvider.LOCAL,
      },
    });

    await tx.hospitalProfile.create({
      data: {
        userId: createdUser.id,
        hospitalName: input.hospitalName,
        registrationNumber: input.registrationNumber,
        address: input.address,
        city: input.city,
        latitude: input.latitude,
        longitude: input.longitude,
        isVerified: false,
      },
    });

    return createdUser;
  });

  const tokens = await issueTokens({ id: user.id, email: user.email, role: user.role });
  return {
    user: sanitizeUser(user),
    tokens,
    notice: "Hospital account created. It must be verified by an admin before you can create blood requests.",
  };
}

// ------------------------------------------------------------------
// Login (email + password)
// ------------------------------------------------------------------
export async function login(email: string, password: string) {
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  if (!user.isActive) throw ApiError.forbidden("This account has been deactivated");

  if (!user.password) {
    throw ApiError.badRequest("This account uses Google sign-in. Please continue with Google.");
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) throw ApiError.unauthorized("Invalid email or password");

  const tokens = await issueTokens({ id: user.id, email: user.email, role: user.role });
  return { user: sanitizeUser(user), tokens };
}

// ------------------------------------------------------------------
// Google Social Login (sign-up on first use, sign-in thereafter)
// ------------------------------------------------------------------
export async function googleAuth(idToken: string, intendedRole?: Role) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.google.clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) throw ApiError.badRequest("Invalid Google token");

  let user = await prisma.user.findFirst({ where: { email: payload.email, deletedAt: null } });

  if (!user) {
    if (!intendedRole) {
      throw ApiError.badRequest("role is required for first-time Google sign-up (DONOR or HOSPITAL)");
    }
    if (intendedRole === Role.ADMIN) {
      throw ApiError.forbidden("Admin accounts cannot self-register");
    }

    user = await prisma.user.create({
      data: {
        name: payload.name ?? payload.email.split("@")[0],
        email: payload.email,
        avatar: payload.picture,
        role: intendedRole,
        provider: AuthProvider.GOOGLE,
        providerId: payload.sub,
        isEmailVerified: payload.email_verified ?? true,
      },
    });
    // NOTE: the donor/hospital profile is intentionally NOT created here —
    // the client must call PATCH /donors/me or /hospitals/me to complete it
    // before the account can fully participate (matching / creating requests).
  } else if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated");
  } else if (user.provider !== AuthProvider.GOOGLE) {
    // Existing local account signing in with Google for the first time — link it.
    user = await prisma.user.update({
      where: { id: user.id },
      data: { provider: AuthProvider.GOOGLE, providerId: payload.sub, avatar: user.avatar ?? payload.picture },
    });
  }

  const tokens = await issueTokens({ id: user.id, email: user.email, role: user.role });
  return { user: sanitizeUser(user), tokens };
}

// ------------------------------------------------------------------
// Refresh token rotation
// ------------------------------------------------------------------
export async function refreshTokens(rawToken: string): Promise<Tokens> {
  let decoded: JwtPayload;
  try {
    decoded = verifyRefreshToken(rawToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { token: tokenHash } });

  if (!stored || stored.revoked || stored.expiresAt < new Date() || stored.userId !== decoded.id) {
    throw ApiError.unauthorized("Refresh token is invalid or has been revoked");
  }

  const user = await prisma.user.findFirst({ where: { id: decoded.id, deletedAt: null } });
  if (!user || !user.isActive) throw ApiError.unauthorized("Account no longer active");

  // Rotate: revoke the used token, issue a brand new pair.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  return issueTokens({ id: user.id, email: user.email, role: user.role });
}

// ------------------------------------------------------------------
// Logout — revoke the refresh token so it can't be replayed
// ------------------------------------------------------------------
export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { token: tokenHash, revoked: false },
    data: { revoked: true },
  });
}
