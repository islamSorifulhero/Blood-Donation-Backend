import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { requestCreationLimiter } from "../../middlewares/rateLimiter";
import * as controller from "../../modules/bloodRequest/bloodRequest.controller";
import {
  createBloodRequestSchema,
  listBloodRequestsQuerySchema,
  bloodRequestIdParamSchema,
  verifyBloodRequestSchema,
  cancelBloodRequestSchema,
  respondToMatchSchema,
} from "../../modules/bloodRequest/bloodRequest.validation";

const router = Router();

// Create — verified hospitals only, rate-limited to prevent spam
router.post(
  "/",
  authenticate,
  authorize(Role.HOSPITAL),
  requestCreationLimiter,
  validateRequest(createBloodRequestSchema),
  controller.createBloodRequest
);

// List — all authenticated roles; visibility rules enforced in the service
// (pagination + filtering by bloodGroup/status/urgency/city + search + sorting)
router.get(
  "/",
  authenticate,
  validateRequest(listBloodRequestsQuerySchema),
  controller.listBloodRequests
);

router.get(
  "/:id",
  authenticate,
  validateRequest(bloodRequestIdParamSchema),
  controller.getBloodRequestById
);

// Admin verification — approves/rejects and triggers the donor-matching engine
router.patch(
  "/:id/verify",
  authenticate,
  authorize(Role.ADMIN),
  validateRequest(verifyBloodRequestSchema),
  controller.verifyBloodRequest
);

// Cancel — owning hospital or admin
router.patch(
  "/:id/cancel",
  authenticate,
  authorize(Role.HOSPITAL, Role.ADMIN),
  validateRequest(cancelBloodRequestSchema),
  controller.cancelBloodRequest
);

// View matched donors for a request — owning hospital or admin
router.get(
  "/:id/matches",
  authenticate,
  authorize(Role.HOSPITAL, Role.ADMIN),
  validateRequest(bloodRequestIdParamSchema),
  controller.listMatchesForRequest
);

// Donor accepts/declines a match notification
router.patch(
  "/:id/matches/:matchId/respond",
  authenticate,
  authorize(Role.DONOR),
  validateRequest(respondToMatchSchema),
  controller.respondToMatch
);

export { router as bloodRequestRouter };
