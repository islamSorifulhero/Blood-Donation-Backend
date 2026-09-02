import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as donationService from "./donation.service";

export const scheduleDonation = catchAsync(async (req: Request, res: Response) => {
  const donation = await donationService.scheduleDonation(req.user!.id, req.body);
  sendResponse(res, { statusCode: 201, message: "Donation scheduled", data: donation });
});

export const listDonations = catchAsync(async (req: Request, res: Response) => {
  const { status, bloodRequestId, donorId, sortBy, sortOrder } = req.query as unknown as {
    status?: import("@prisma/client").DonationStatus;
    bloodRequestId?: string;
    donorId?: string;
    sortBy?: "donationDate" | "createdAt";
    sortOrder?: "asc" | "desc";
  };
  const result = await donationService.listDonations(
    { status, bloodRequestId, donorId, sortBy, sortOrder },
    req.query,
    req.user!
  );
  sendResponse(res, { statusCode: 200, message: "Donations fetched", data: result.items, meta: result.meta });
});

export const getDonationById = catchAsync(async (req: Request, res: Response) => {
  const donation = await donationService.getDonationById(req.params.id, req.user!);
  sendResponse(res, { statusCode: 200, message: "Donation fetched", data: donation });
});

export const completeDonation = catchAsync(async (req: Request, res: Response) => {
  const { unitsDonated, notes } = req.body ?? {};
  const result = await donationService.completeDonation(req.params.id, req.user!, unitsDonated, notes);
  sendResponse(res, { statusCode: 200, message: "Donation completed", data: result });
});

export const cancelDonation = catchAsync(async (req: Request, res: Response) => {
  await donationService.cancelDonation(req.params.id, req.user!, req.body?.reason);
  sendResponse(res, { statusCode: 200, message: "Donation cancelled" });
});

export const markNoShow = catchAsync(async (req: Request, res: Response) => {
  await donationService.markNoShow(req.params.id, req.user!, req.body?.notes);
  sendResponse(res, { statusCode: 200, message: "Donation marked as no-show" });
});

export const rescheduleDonation = catchAsync(async (req: Request, res: Response) => {
  const { donationDate, location } = req.body;
  const donation = await donationService.rescheduleDonation(req.params.id, req.user!.id, donationDate, location);
  sendResponse(res, { statusCode: 200, message: "Donation rescheduled", data: donation });
});
