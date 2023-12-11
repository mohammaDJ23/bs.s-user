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
import { EncryptedUserObj, SocketPayloadType } from 'src/types';
import { User } from 'src/entities';

interface MessageObj {
  userId: number;
  id: string;
  text: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
  deletedAt: FieldValue | null;
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

interface SendMessageObj {
  user: User;
  conversation: ConversationDocObj;
  text: string;
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

  getCreatorRoomId(creator: EncryptedUserObj, target: User) {
    return `${creator.id}.${target.id}`;
  }

  getTargetRoomId(target: User, creator: EncryptedUserObj) {
    return `${target.id}.${creator.id}`;
  }

  @SubscribeMessage('start-conversation')
  async startConversation(client: Socket, data: SocketPayloadType<User>) {
    try {
      const creatorRoomId = this.getCreatorRoomId(client.user, data.payload);
      const targetRoomId = this.getTargetRoomId(data.payload, client.user);

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

        await this.firebase.firestore
          .collection('conversation')
          .doc(docData.roomId)
          .update({
            contributors: FieldValue.arrayUnion(client.user.id),
            updatedAt: FieldValue.serverTimestamp(),
          });
      }

      this.wss.to(client.id).emit('success-start-conversation', data.payload);
    } catch (error) {
      this.wss
        .to(client.id)
        .emit(
          'fail-start-conversation',
          new InternalServerErrorException(error),
        );
    }
  }

  @SubscribeMessage('send-message')
  async sendMessage(client: Socket, data: SocketPayloadType<SendMessageObj>) {
    try {
      const creatorRoomId = this.getCreatorRoomId(
        client.user,
        data.payload.user,
      );
      const targetRoomId = this.getTargetRoomId(data.payload.user, client.user);

      const result = await this.firebase.firestore
        .collection('conversation')
        .where(
          Filter.or(
            Filter.where('roomId', '==', creatorRoomId),
            Filter.where('roomId', '==', targetRoomId),
          ),
        )
        .get();

      if (!result.empty) {
        const message: MessageObj = {
          id: uuid(),
          userId: client.user.id,
          text: data.payload.text,
          isReaded: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          deletedAt: null,
        };

        const [doc] = result.docs;
        const conversationDocData = doc.data() as ConversationDocObj;

        const conversationDocRef = this.firebase.firestore
          .collection('conversation')
          .doc(conversationDocData.roomId);

        const messageDocRef = conversationDocRef
          .collection('messages')
          .doc(message.id);

        const batch = this.firebase.firestore.batch();

        batch.update(conversationDocRef, {
          contributors: FieldValue.arrayUnion(data.payload.user.id),
          lastMessage: message,
          updatedAt: FieldValue.serverTimestamp(),
        });

        batch.set(messageDocRef, message);

        await batch.commit();

        this.wss.to(client.id).emit('success-send-message', data.payload);
      } else {
        throw new Error('No document was found.');
      }
    } catch (error) {
      this.wss
        .to(client.id)
        .emit('fail-send-message', new InternalServerErrorException(error));
    }
  }
}
