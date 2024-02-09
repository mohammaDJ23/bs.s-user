import {
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Catch,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const exceptionResponse = exception.getResponse();

    const statusCode =
      exceptionResponse instanceof Object
        ? // @ts-ignore
          exceptionResponse.statusCode
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(statusCode).json({
      statusCode,
      message:
        exceptionResponse instanceof Object
          ? // @ts-ignore
            exceptionResponse.message
          : 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
