import {
  ExceptionFilter,
  ArgumentsHost,
  Catch,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(Object)
export class ObjectExceptionFilter implements ExceptionFilter {
  catch(exception: object, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // @ts-ignore
    const statusCode = exception.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(statusCode).json({
      statusCode,
      // @ts-ignore
      message: exception.message || 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
