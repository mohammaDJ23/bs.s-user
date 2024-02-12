import {
  ExceptionFilter,
  ArgumentsHost,
  Catch,
  HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Request, Response } from 'express';

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // @ts-ignore
    const exceptionResponse = exception.getError().response;

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
