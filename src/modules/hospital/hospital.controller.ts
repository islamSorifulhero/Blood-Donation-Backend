import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as hospitalService from "./hospital.service";

export const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await hospitalService.getMyProfile(req.user!.id);
  sendResponse(res, { statusCode: 200, message: "Hospital profile fetched", data: profile });
});

export const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await hospitalService.updateMyProfile(req.user!.id, req.body);
  sendResponse(res, { statusCode: 200, message: "Hospital profile updated", data: profile });
});

export const listHospitals = catchAsync(async (req: Request, res: Response) => {
  const { city, isVerified, search, sortBy, sortOrder } = req.query as unknown as {
    city?: string;
    isVerified?: boolean;
    search?: string;
    sortBy?: "createdAt" | "hospitalName";
    sortOrder?: "asc" | "desc";
  };
  const result = await hospitalService.listHospitals(
    { city, isVerified, search, sortBy, sortOrder, requesterRole: req.user!.role },
    req.query
  );
  sendResponse(res, { statusCode: 200, message: "Hospitals fetched", data: result.items, meta: result.meta });
});

export const getHospitalById = catchAsync(async (req: Request, res: Response) => {
  const hospital = await hospitalService.getHospitalById(req.params.id, req.user!.role);
  sendResponse(res, { statusCode: 200, message: "Hospital fetched", data: hospital });
});

export const verifyHospital = catchAsync(async (req: Request, res: Response) => {
  const { isVerified, remarks } = req.body;
  const hospital = await hospitalService.verifyHospital(req.params.id, req.user!.id, isVerified, remarks);
  sendResponse(res, {
    statusCode: 200,
    message: isVerified ? "Hospital verified" : "Hospital verification revoked",
    data: hospital,
  });
});

export const deactivateHospital = catchAsync(async (req: Request, res: Response) => {
  await hospitalService.deactivateHospital(req.params.id, req.user!.id);
  sendResponse(res, { statusCode: 200, message: "Hospital deactivated" });
});
