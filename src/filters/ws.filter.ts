import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import { WsErrorObj, WsException } from 'src/exceptions';
import { Socket } from 'src/types';

@Catch(WsException)
export class WsFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const error = exception.getError() as WsErrorObj;
    client.emit('error', error);
  }
}
