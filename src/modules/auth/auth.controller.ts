import { Request, Response } from "express";
import { CookieOptions } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import * as authService from "./auth.service";

const REFRESH_COOKIE = "refreshToken";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: env.nodeEnv === "production" ? "none" : "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days — keep in sync with JWT_REFRESH_EXPIRES_IN
  path: "/",
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, cookieOptions);
}

function getRefreshTokenFromRequest(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
}

export const registerDonor = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.registerDonor(req.body);
  setRefreshCookie(res, result.tokens.refreshToken);
  sendResponse(res, {
    statusCode: 201,
    message: "Donor registered successfully",
    data: { user: result.user, accessToken: result.tokens.accessToken },
  });
});

export const registerHospital = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.registerHospital(req.body);
  setRefreshCookie(res, result.tokens.refreshToken);
  sendResponse(res, {
    statusCode: 201,
    message: result.notice,
    data: { user: result.user, accessToken: result.tokens.accessToken },
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  setRefreshCookie(res, result.tokens.refreshToken);
  sendResponse(res, {
    statusCode: 200,
    message: "Logged in successfully",
    data: { user: result.user, accessToken: result.tokens.accessToken },
  });
});

export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const { idToken, role } = req.body;
  const result = await authService.googleAuth(idToken, role);
  setRefreshCookie(res, result.tokens.refreshToken);
  sendResponse(res, {
    statusCode: 200,
    message: "Authenticated with Google successfully",
    data: { user: result.user, accessToken: result.tokens.accessToken },
  });
});

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const token = getRefreshTokenFromRequest(req);
  if (!token) throw ApiError.unauthorized("Refresh token missing");

  const tokens = await authService.refreshTokens(token);
  setRefreshCookie(res, tokens.refreshToken);
  sendResponse(res, {
    statusCode: 200,
    message: "Access token refreshed",
    data: { accessToken: tokens.accessToken },
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const token = getRefreshTokenFromRequest(req);
  await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, { path: "/" });
  sendResponse(res, {
    statusCode: 200,
    message: "Logged out successfully",
  });
});
