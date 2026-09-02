import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as adminService from "./admin.service";

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { role, isActive, search, sortBy, sortOrder } = req.query as unknown as {
    role?: import("@prisma/client").Role;
    isActive?: boolean;
    search?: string;
    sortBy?: "createdAt" | "name";
    sortOrder?: "asc" | "desc";
  };
  const result = await adminService.listUsers({ role, isActive, search, sortBy, sortOrder }, req.query);
  sendResponse(res, { statusCode: 200, message: "Users fetched", data: result.items, meta: result.meta });
});

export const updateUserRole = catchAsync(async (req: Request, res: Response) => {
  const updated = await adminService.updateUserRole(req.params.id, req.user!.id, req.body.role);
  sendResponse(res, { statusCode: 200, message: "User role updated", data: updated });
});

export const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const { isActive, reason } = req.body;
  const updated = await adminService.updateUserStatus(req.params.id, req.user!.id, isActive, reason);
  sendResponse(res, { statusCode: 200, message: "User status updated", data: updated });
});

export const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  sendResponse(res, { statusCode: 200, message: "Dashboard stats fetched", data: stats });
});

export const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { entityType, action, actorId, from, to, sortOrder } = req.query as unknown as {
    entityType?: string;
    action?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    sortOrder?: "asc" | "desc";
  };
  const result = await adminService.listAuditLogs({ entityType, action, actorId, from, to, sortOrder }, req.query);
  sendResponse(res, { statusCode: 200, message: "Audit logs fetched", data: result.items, meta: result.meta });
});
