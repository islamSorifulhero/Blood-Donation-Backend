import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import * as controller from "../../modules/notification/notification.controller";
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from "../../modules/notification/notification.validation";

const router = Router();

router.use(authenticate); // every notification belongs to the logged-in user

router.get("/", validateRequest(listNotificationsQuerySchema), controller.listMyNotifications);
router.get("/unread-count", controller.getUnreadCount);
router.patch("/:id/read", validateRequest(notificationIdParamSchema), controller.markAsRead);
router.patch("/read-all", controller.markAllAsRead);

export { router as notificationRouter };
