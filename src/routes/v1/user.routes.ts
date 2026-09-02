import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import * as controller from "../../modules/user/user.controller";
import { updateMeSchema, changePasswordSchema } from "../../modules/user/user.validation";

const router = Router();

router.use(authenticate);

// Generic account info/update — works for every role (DONOR/HOSPITAL/ADMIN).
// Role-specific fields (blood group, hospital name, etc.) live under /donors/me and /hospitals/me.
router.get("/me", controller.getMe);
router.patch("/me", validateRequest(updateMeSchema), controller.updateMe);
router.patch("/me/change-password", validateRequest(changePasswordSchema), controller.changePassword);

export { router as userRouter };
