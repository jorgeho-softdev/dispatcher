import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  isErrorCode,
  type ApiErrorDto,
  type ErrorCode,
} from '@dispatcher/shared';
import type { Response } from 'express';

const DEFAULT_CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'AUTH_TOKEN_INVALID',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  503: 'API_UNAVAILABLE',
};

/**
 * Every error leaves the api with the same shape (ApiErrorDto) and a stable
 * `code`, so clients can translate it into the user's language. Unknown
 * errors become 500 INTERNAL_ERROR without leaking internals.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Partial<ApiErrorDto> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();
      body = typeof raw === 'string' ? { message: raw } : raw;
    } else {
      this.logger.error(exception);
    }

    const payload: ApiErrorDto = {
      statusCode: status,
      code: isErrorCode(body.code)
        ? body.code
        : (DEFAULT_CODE_BY_STATUS[status] ?? 'INTERNAL_ERROR'),
      message:
        status >= 500 && !(exception instanceof HttpException)
          ? 'Internal server error'
          : String(body.message ?? ''),
      ...(body.issues && { issues: body.issues }),
    };
    res.status(status).json(payload);
  }
}
