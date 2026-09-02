import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import * as controller from "../../modules/donation/donation.controller";
import {
  scheduleDonationSchema,
  listDonationsQuerySchema,
  donationIdParamSchema,
  completeDonationSchema,
  cancelDonationSchema,
  noShowDonationSchema,
  rescheduleDonationSchema,
} from "../../modules/donation/donation.validation";

const router = Router();

// Donor schedules a donation for a match they've ACCEPTED
router.post(
  "/",
  authenticate,
  authorize(Role.DONOR),
  validateRequest(scheduleDonationSchema),
  controller.scheduleDonation
);

// List — role-scoped (donor: own, hospital: theirs, admin: all + donorId filter)
// supports pagination + filtering (status, bloodRequestId) + sorting
router.get("/", authenticate, validateRequest(listDonationsQuerySchema), controller.listDonations);

router.get("/:id", authenticate, validateRequest(donationIdParamSchema), controller.getDonationById);

// Core completion transaction — hospital owner or admin
router.patch(
  "/:id/complete",
  authenticate,
  authorize(Role.HOSPITAL, Role.ADMIN),
  validateRequest(completeDonationSchema),
  controller.completeDonation
);

router.patch(
  "/:id/reschedule",
  authenticate,
  authorize(Role.DONOR),
  validateRequest(rescheduleDonationSchema),
  controller.rescheduleDonation
);

router.patch(
  "/:id/cancel",
  authenticate,
  authorize(Role.DONOR, Role.HOSPITAL, Role.ADMIN),
  validateRequest(cancelDonationSchema),
  controller.cancelDonation
);

router.patch(
  "/:id/no-show",
  authenticate,
  authorize(Role.HOSPITAL, Role.ADMIN),
  validateRequest(noShowDonationSchema),
  controller.markNoShow
);

export { router as donationRouter };
