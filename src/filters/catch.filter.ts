import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces/features/arguments-host.interface';
import { AbstractHttpAdapter, HttpAdapterHost } from '@nestjs/core';
import { MESSAGES } from '@nestjs/core/constants';
import { Exception } from 'src/types';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: any, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const responseBody = this.getResponseBody(httpAdapter, ctx, exception);
    httpAdapter.reply(ctx.getResponse(), responseBody, responseBody.statusCode);
  }

  private getResponseBody(
    httpAdapter: AbstractHttpAdapter,
    ctx: HttpArgumentsHost,
    exception: any,
  ) {
    const { statusCode, message } = this.getExceptionInfo(exception);
    const timestamp = new Date().toISOString();
    const path = httpAdapter.getRequestUrl(ctx.getRequest());
    const responseBody = { statusCode, message, timestamp, path };
    return responseBody;
  }

  private getMessage(exception: Exception) {
    return exception instanceof Object ? exception.message : exception;
  }

  private getStatusCode(exception: Exception) {
    return exception instanceof Object
      ? exception.statusCode
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getExceptionInfo(exception: any) {
    if (process.env.NODE_ENV === 'development')
      console.log(exception, exception.constructor.name);

    // errors which are an string
    const isStringException = typeof exception === 'string';

    // error response
    let message = MESSAGES.UNKNOWN_EXCEPTION_MESSAGE;
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    switch (true) {
      case isStringException: {
        message = exception;
        break;
      }

      default:
        if ('message' in exception) {
          message = exception.message;
        }

        break;
    }

    return { message, statusCode };
  }
}
