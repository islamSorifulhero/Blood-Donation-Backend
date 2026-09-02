import { Router } from "express";
import * as authController from "../../modules/auth/auth.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { authLimiter } from "../../middlewares/rateLimiter";
import { sendResponse } from "../../utils/sendResponse";
import { Role } from "@prisma/client";
import {
  registerDonorSchema,
  registerHospitalSchema,
  loginSchema,
  googleAuthSchema,
  refreshTokenSchema,
} from "../../modules/auth/auth.validation";

const router = Router();

router.post(
  "/register/donor",
  authLimiter,
  validateRequest(registerDonorSchema),
  authController.registerDonor
);

router.post(
  "/register/hospital",
  authLimiter,
  validateRequest(registerHospitalSchema),
  authController.registerHospital
);

router.post("/login", authLimiter, validateRequest(loginSchema), authController.login);

router.post("/google", authLimiter, validateRequest(googleAuthSchema), authController.googleAuth);

router.post("/refresh-token", validateRequest(refreshTokenSchema), authController.refreshToken);

router.post("/logout", authController.logout);

// Demo endpoint proving authenticate + role middleware are wired correctly.
// (Real per-role checks live in each module's own routes — this just shows the pattern.)
router.get("/whoami", authenticate, (req, res) => {
  sendResponse(res, { statusCode: 200, message: "Token is valid", data: req.user });
});
router.get("/admin-only-check", authenticate, authorize(Role.ADMIN), (req, res) => {
  sendResponse(res, { statusCode: 200, message: "Admin access confirmed", data: req.user });
});

export { router as authRouter };
