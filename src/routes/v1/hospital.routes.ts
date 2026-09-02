import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import * as hospitalController from "../../modules/hospital/hospital.controller";
import {
  updateHospitalProfileSchema,
  listHospitalsQuerySchema,
  hospitalIdParamSchema,
  verifyHospitalSchema,
} from "../../modules/hospital/hospital.validation";

const router = Router();

router.get("/me", authenticate, authorize(Role.HOSPITAL), hospitalController.getMyProfile);

router.patch(
  "/me",
  authenticate,
  authorize(Role.HOSPITAL),
  validateRequest(updateHospitalProfileSchema),
  hospitalController.updateMyProfile
);

// Any authenticated role can browse hospitals; non-admins only ever see verified ones (enforced in service)
router.get(
  "/",
  authenticate,
  validateRequest(listHospitalsQuerySchema),
  hospitalController.listHospitals
);

router.get(
  "/:id",
  authenticate,
  validateRequest(hospitalIdParamSchema),
  hospitalController.getHospitalById
);

// Admin verification workflow
router.patch(
  "/:id/verify",
  authenticate,
  authorize(Role.ADMIN),
  validateRequest(verifyHospitalSchema),
  hospitalController.verifyHospital
);

router.delete(
  "/:id",
  authenticate,
  authorize(Role.ADMIN),
  validateRequest(hospitalIdParamSchema),
  hospitalController.deactivateHospital
);

export { router as hospitalRouter };
