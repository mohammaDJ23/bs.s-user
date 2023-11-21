import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtSocketGuard } from 'src/guards';
import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';
import { Socket } from 'src/adapters';
import { UserObj } from 'src/types';

type StartConversationEventPayloadType = Record<'payload', UserObj>;

@WebSocketGateway({
  path: '/api/v1/user/socket/chat',
  cors: {
    origin: [
      process.env.CLIENT_CONTAINER_URL,
      process.env.CLIENT_AUTH_URL,
      process.env.CLIENT_BANK_URL,
    ],
  },
})
@UseGuards(JwtSocketGuard)
export class ChatGateWay {
  @WebSocketServer()
  private wss: Server;

  constructor(
    @InjectFirebaseAdmin() private readonly firebase: FirebaseAdmin,
  ) {}

  @SubscribeMessage('start-conversation')
  startConversation(client: Socket, data: StartConversationEventPayloadType) {}
}
