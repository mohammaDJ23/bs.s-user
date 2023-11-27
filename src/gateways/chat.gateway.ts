import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { JwtSocketGuard } from 'src/guards';
import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';
import { FieldValue, Filter } from '@google-cloud/firestore';
import { Socket } from 'src/adapters';
import { SocketPayloadType } from 'src/types';
import { User } from 'src/entities';

interface MessageObj {
  userId: number;
  id: string;
  text: string;
  createdAt: FieldValue;
  isReaded: boolean;
}

interface ConversationDocObj {
  id: string;
  creatorId: number;
  targetId: number;
  roomId: string;
  contributors: number[];
  lastMessage: MessageObj | null;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
  deletedAt: FirebaseFirestore.FieldValue | null;
  deletedBy: number | null;
}

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
  async startConversation(client: Socket, data: SocketPayloadType<User>) {}
}
