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
import { UserService } from 'src/services';
import { getConversationTargetId } from 'src/libs/conversationTargetId';

interface MessageObj {
  id: string;
  userId: number;
  text: string;
  isReaded: boolean;
  status: 'pending' | 'success' | 'error';
  createdAt: FieldValue;
  updatedAt: FieldValue;
  deletedAt: FieldValue | null;
}

export interface ConversationDocObj {
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

export interface ConversationObj {
  user: User;
  conversation: ConversationDocObj;
}

interface SendMessageObj {
  message: MessageObj;
  roomId: string;
  conversationId: string;
}

export class Conversation implements ConversationObj {
  constructor(
    public readonly user: User,
    public readonly conversation: ConversationDocObj,
  ) {}
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
  private conversationCollection: string =
    process.env.FIREBASE_CONVERSATION_COLLECTION!;

  constructor(
    @InjectFirebaseAdmin() private readonly firebase: FirebaseAdmin,
    private readonly userService: UserService,
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
      await this.userService.findByIdOrFail(data.payload.id);

      const creatorRoomId = this.getCreatorRoomId(client.user, data.payload);
      const targetRoomId = this.getTargetRoomId(data.payload, client.user);

      let conversationDocObj: ConversationDocObj;

      const result = await this.firebase.firestore
        .collection(this.conversationCollection)
        .where(
          Filter.or(
            Filter.where('roomId', '==', creatorRoomId),
            Filter.where('roomId', '==', targetRoomId),
          ),
        )
        .get();

      if (result.empty) {
        const doc: ConversationDocObj = {
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
          .collection(this.conversationCollection)
          .doc(creatorRoomId)
          .set(doc);

        conversationDocObj = doc;
      } else {
        const [doc] = result.docs;
        const docData = doc.data() as ConversationDocObj;

        await this.firebase.firestore
          .collection(this.conversationCollection)
          .doc(docData.roomId)
          .update({
            contributors: FieldValue.arrayUnion(client.user.id),
            updatedAt: FieldValue.serverTimestamp(),
          });

        conversationDocObj = docData;
      }

      this.wss
        .to(client.id)
        .emit(
          'success-start-conversation',
          new Conversation(data.payload, conversationDocObj),
        );
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
      const result = await this.firebase.firestore
        .collection(this.conversationCollection)
        .where(
          Filter.and(
            Filter.where('roomId', '==', data.payload.roomId),
            Filter.where('id', '==', data.payload.conversationId),
          ),
        )
        .get();

      if (!result.empty) {
        const message: MessageObj = {
          id: data.payload.message.id,
          userId: data.payload.message.userId,
          text: data.payload.message.text,
          isReaded: data.payload.message.isReaded,
          status: 'success',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          deletedAt: null,
        };

        const [doc] = result.docs;
        const conversationDocData = doc.data() as ConversationDocObj;

        const conversationDocRef = this.firebase.firestore
          .collection(this.conversationCollection)
          .doc(conversationDocData.roomId);

        const messageDocRef = conversationDocRef
          .collection('messages')
          .doc(message.id);

        const batch = this.firebase.firestore.batch();

        batch.update(conversationDocRef, {
          contributors: FieldValue.arrayUnion(
            getConversationTargetId(client.user, conversationDocData),
          ),
          lastMessage: message,
          updatedAt: FieldValue.serverTimestamp(),
        });

        batch.set(messageDocRef, message);

        await batch.commit();

        data.payload.message.status = 'success';

        this.wss.emit(data.payload.roomId, data.payload);
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
