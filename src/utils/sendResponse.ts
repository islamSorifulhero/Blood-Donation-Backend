import { Response } from "express";

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

interface SuccessPayload<T> {
  statusCode: number;
  message: string;
  data?: T;
  meta?: Meta;
}

export function sendResponse<T>(res: Response, payload: SuccessPayload<T>) {
  return res.status(payload.statusCode).json({
    success: true,
    message: payload.message,
    data: payload.data ?? null,
    ...(payload.meta ? { meta: payload.meta } : {}),
  });
}
