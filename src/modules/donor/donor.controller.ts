import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as donorService from "./donor.service";

export const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await donorService.getMyProfile(req.user!.id);
  sendResponse(res, { statusCode: 200, message: "Donor profile fetched", data: profile });
});

export const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await donorService.updateMyProfile(req.user!.id, req.body);
  sendResponse(res, { statusCode: 200, message: "Donor profile updated", data: profile });
});

export const listDonors = catchAsync(async (req: Request, res: Response) => {
  // isAvailable arrives here already coerced to a real boolean by validateRequest (Zod transform)
  const { bloodGroup, city, isAvailable, sortBy, sortOrder } = req.query as unknown as {
    bloodGroup?: string;
    city?: string;
    isAvailable?: boolean;
    sortBy?: "createdAt" | "lastDonationDate" | "totalDonations";
    sortOrder?: "asc" | "desc";
  };
  const result = await donorService.listDonors({ bloodGroup, city, isAvailable, sortBy, sortOrder }, req.query);
  sendResponse(res, {
    statusCode: 200,
    message: "Donors fetched",
    data: result.items,
    meta: result.meta,
  });
});

export const getDonorById = catchAsync(async (req: Request, res: Response) => {
  const donor = await donorService.getDonorById(req.params.id);
  sendResponse(res, { statusCode: 200, message: "Donor fetched", data: donor });
});

export const deactivateDonor = catchAsync(async (req: Request, res: Response) => {
  await donorService.deactivateDonor(req.params.id, req.user!.id);
  sendResponse(res, { statusCode: 200, message: "Donor deactivated" });
});
