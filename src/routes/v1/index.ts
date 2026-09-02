import { Router } from "express";
import { authRouter } from "./auth.routes";
import { userRouter } from "./user.routes";
import { donorRouter } from "./donor.routes";
import { hospitalRouter } from "./hospital.routes";
import { bloodRequestRouter } from "./bloodRequest.routes";
import { donationRouter } from "./donation.routes";
import { paymentRouter } from "./payment.routes";
import { notificationRouter } from "./notification.routes";
import { adminRouter } from "./admin.routes";

export const router = Router();

router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/donors", donorRouter);
router.use("/hospitals", hospitalRouter);
router.use("/blood-requests", bloodRequestRouter);
router.use("/donations", donationRouter);
router.use("/payments", paymentRouter);
router.use("/notifications", notificationRouter);
router.use("/admin", adminRouter);
