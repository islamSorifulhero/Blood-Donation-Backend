import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Access token missing"));
  }

  const token = header.split(" ")[1];

  try {
    const payload = jwt.verify(token, env.jwt.accessSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired access token"));
  }
}
