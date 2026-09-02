import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import * as donorController from "../../modules/donor/donor.controller";
import {
  updateDonorProfileSchema,
  listDonorsQuerySchema,
  donorIdParamSchema,
} from "../../modules/donor/donor.validation";

const router = Router();

router.get("/me", authenticate, authorize(Role.DONOR), donorController.getMyProfile);

router.patch(
  "/me",
  authenticate,
  authorize(Role.DONOR),
  validateRequest(updateDonorProfileSchema),
  donorController.updateMyProfile
);

// Donor discovery for hospitals/admins — supports pagination + filtering (bloodGroup, city, isAvailable) + sorting
router.get(
  "/",
  authenticate,
  authorize(Role.HOSPITAL, Role.ADMIN),
  validateRequest(listDonorsQuerySchema),
  donorController.listDonors
);

router.get(
  "/:id",
  authenticate,
  authorize(Role.HOSPITAL, Role.ADMIN),
  validateRequest(donorIdParamSchema),
  donorController.getDonorById
);

// Soft delete / deactivate
router.delete(
  "/:id",
  authenticate,
  authorize(Role.ADMIN),
  validateRequest(donorIdParamSchema),
  donorController.deactivateDonor
);

export { router as donorRouter };
