import { WsException as WebSocketException } from '@nestjs/websockets';

export interface WsErrorObj {
  event: string;
  message: string;
  timestamp: string;
}

export class WsException extends WebSocketException {
  constructor(public readonly event: string, public readonly message: string) {
    const timestamp: string = new Date().toISOString();
    const error: WsErrorObj = { event, message, timestamp };
    super(error);
  }
}
