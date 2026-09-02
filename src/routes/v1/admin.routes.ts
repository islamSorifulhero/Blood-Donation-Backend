import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import * as controller from "../../modules/admin/admin.controller";
import {
  listUsersQuerySchema,
  userIdParamSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  listAuditLogsQuerySchema,
} from "../../modules/admin/admin.validation";

const router = Router();

// Every route in this module is admin-only.
router.use(authenticate, authorize(Role.ADMIN));

router.get("/users", validateRequest(listUsersQuerySchema), controller.listUsers);
router.patch("/users/:id/role", validateRequest(updateUserRoleSchema), controller.updateUserRole);
router.patch("/users/:id/status", validateRequest(updateUserStatusSchema), controller.updateUserStatus);

router.get("/dashboard-stats", controller.getDashboardStats);
router.get("/audit-logs", validateRequest(listAuditLogsQuerySchema), controller.listAuditLogs);

export { router as adminRouter };
