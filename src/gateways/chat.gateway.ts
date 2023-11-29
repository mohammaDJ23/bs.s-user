import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InternalServerErrorException, UseGuards } from '@nestjs/common';
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
  createdAt: FieldValue;
  updatedAt: FieldValue;
  deletedAt: FieldValue | null;
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
  async startConversation(client: Socket, data: SocketPayloadType<User>) {
    try {
      const creatorRoomId = `${client.user.id}.${data.payload.id}`;
      const targetRoomId = `${data.payload.id}.${client.user.id}`;

      const result = await this.firebase.firestore
        .collection('conversation')
        .where(
          Filter.or(
            Filter.where('roomId', '==', creatorRoomId),
            Filter.where('roomId', '==', targetRoomId),
          ),
        )
        .get();

      if (result.empty) {
        const doc = {
          id: uuid(),
          creatorId: client.user.id,
          targetId: data.payload.id,
          roomId: creatorRoomId,
          contributors: [client.user.id],
          lastMessage: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          deletedAt: null,
          deletedBy: null,
        };

        await this.firebase.firestore
          .collection('conversation')
          .doc(creatorRoomId)
          .set(doc);
      } else {
        const [doc] = result.docs;
        const docData = doc.data();

        if (!docData.contributors.includes(client.user.id)) {
          await this.firebase.firestore
            .collection('conversation')
            .doc(docData.roomId)
            .update({
              contributors: FieldValue.arrayUnion(client.user.id),
              updatedAt: FieldValue.serverTimestamp(),
            });
        }
      }

      this.wss.to(client.id).emit('success-start-conversation');
    } catch (error) {
      this.wss
        .to(client.id)
        .emit(
          'fail-start-conversation',
          new InternalServerErrorException(error),
        );
    }
  }
}
