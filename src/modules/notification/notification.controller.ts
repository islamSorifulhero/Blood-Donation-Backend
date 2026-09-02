import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as notificationService from "./notification.service";

export const listMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const { isRead } = req.query as unknown as { isRead?: boolean };
  const result = await notificationService.listMyNotifications(req.user!.id, isRead, req.query);
  sendResponse(res, { statusCode: 200, message: "Notifications fetched", data: result.items, meta: result.meta });
});

export const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const data = await notificationService.getUnreadCount(req.user!.id);
  sendResponse(res, { statusCode: 200, message: "Unread count fetched", data });
});

export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const notification = await notificationService.markAsRead(req.user!.id, req.params.id);
  sendResponse(res, { statusCode: 200, message: "Notification marked as read", data: notification });
});

export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  const data = await notificationService.markAllAsRead(req.user!.id);
  sendResponse(res, { statusCode: 200, message: "All notifications marked as read", data });
});
