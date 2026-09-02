import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as userService from "./user.service";

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.getMe(req.user!.id);
  sendResponse(res, { statusCode: 200, message: "Current user fetched", data: user });
});

export const updateMe = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateMe(req.user!.id, req.body);
  sendResponse(res, { statusCode: 200, message: "Profile updated", data: user });
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await userService.changePassword(req.user!.id, currentPassword, newPassword);
  sendResponse(res, { statusCode: 200, message: "Password changed successfully" });
});
