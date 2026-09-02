import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as bloodRequestService from "./bloodRequest.service";

export const createBloodRequest = catchAsync(async (req: Request, res: Response) => {
  const request = await bloodRequestService.createBloodRequest(req.user!.id, req.body);
  sendResponse(res, {
    statusCode: 201,
    message: "Blood request submitted and is pending admin verification",
    data: request,
  });
});

export const listBloodRequests = catchAsync(async (req: Request, res: Response) => {
  const { bloodGroup, status, urgency, city, search, mine, sortBy, sortOrder } = req.query as unknown as {
    bloodGroup?: string;
    status?: string;
    urgency?: string;
    city?: string;
    search?: string;
    mine?: boolean;
    sortBy?: "createdAt" | "requiredBy" | "urgency";
    sortOrder?: "asc" | "desc";
  };
  const result = await bloodRequestService.listBloodRequests(
    { bloodGroup, status, urgency, city, search, mine, sortBy, sortOrder },
    req.query,
    req.user!
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Blood requests fetched",
    data: result.items,
    meta: result.meta,
  });
});

export const getBloodRequestById = catchAsync(async (req: Request, res: Response) => {
  const request = await bloodRequestService.getBloodRequestById(req.params.id, req.user!);
  sendResponse(res, { statusCode: 200, message: "Blood request fetched", data: request });
});

export const verifyBloodRequest = catchAsync(async (req: Request, res: Response) => {
  const { isVerified, remarks } = req.body;
  const { updated, matchResult } = await bloodRequestService.verifyBloodRequest(
    req.params.id,
    req.user!.id,
    isVerified,
    remarks
  );
  sendResponse(res, {
    statusCode: 200,
    message: isVerified
      ? `Request verified. Matched ${matchResult.matchedCount} compatible donor(s).`
      : "Request rejected",
    data: { request: updated, matchedCount: matchResult.matchedCount },
  });
});

export const cancelBloodRequest = catchAsync(async (req: Request, res: Response) => {
  await bloodRequestService.cancelBloodRequest(req.params.id, req.user!, req.body?.reason);
  sendResponse(res, { statusCode: 200, message: "Blood request cancelled" });
});

export const listMatchesForRequest = catchAsync(async (req: Request, res: Response) => {
  const matches = await bloodRequestService.listMatchesForRequest(req.params.id, req.user!);
  sendResponse(res, { statusCode: 200, message: "Matches fetched", data: matches });
});

export const respondToMatch = catchAsync(async (req: Request, res: Response) => {
  const { response } = req.body;
  const match = await bloodRequestService.respondToMatch(
    req.params.id,
    req.params.matchId,
    req.user!.id,
    response
  );
  sendResponse(res, {
    statusCode: 200,
    message: response === "ACCEPTED" ? "You accepted this donation request" : "You declined this request",
    data: match,
  });
});
