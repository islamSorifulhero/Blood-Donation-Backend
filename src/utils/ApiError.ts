export class ApiError extends Error {
  statusCode: number;
  errors: unknown[];
  isOperational: boolean;

  constructor(statusCode: number, message: string, errors: unknown[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", errors: unknown[] = []) {
    return new ApiError(400, message, errors);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }
  static conflict(message = "Conflict", errors: unknown[] = []) {
    return new ApiError(409, message, errors);
  }
  static internal(message = "Something went wrong") {
    return new ApiError(500, message);
  }
}
