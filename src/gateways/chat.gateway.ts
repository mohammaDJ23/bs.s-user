import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  InternalServerErrorException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Server } from 'socket.io';
import { plainToClass } from 'class-transformer';
import { v4 as uuid } from 'uuid';
import { JwtSocketGuard } from 'src/guards';
import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';
import { FieldValue, Filter } from '@google-cloud/firestore';
import { Socket } from 'src/adapters';
import { EncryptedUserObj, SocketPayloadType } from 'src/types';
import { User } from 'src/entities';
import { UserService } from 'src/services';
import { getConversationTargetId } from 'src/libs/conversationTargetId';
import {
  MakeRoomIdsDto,
  MessageObj,
  MessageStatus,
  SendMessageDto,
  StartConversationDto,
  UserDto,
} from 'src/dtos';

export interface ConversationDocObj {
  id: string;
  creatorId: number;
  targetId: number;
  isCreatorTyping: boolean;
  isTargetTyping: boolean;
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

export class Conversation implements ConversationObj {
  constructor(
    public readonly user: User,
    public readonly conversation: ConversationDocObj,
  ) {}
}

interface TypingTextObj {
  roomId: string;
  userId: number;
}

interface StopingTextObj extends TypingTextObj {}

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

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('start-conversation')
  async startConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartConversationDto,
  ) {
    try {
      const user = await this.userService.findByIdOrFail(data.id);

      const creatorRoomId = this.getCreatorRoomId(client.user, user);
      const targetRoomId = this.getTargetRoomId(user, client.user);

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
          targetId: user.id,
          roomId: creatorRoomId,
          isCreatorTyping: false,
          isTargetTyping: false,
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

      const plainUser = plainToClass(UserDto, user, {
        excludeExtraneousValues: true,
      }) as unknown as User;

      this.wss
        .to(client.id)
        .emit(
          'success-start-conversation',
          new Conversation(plainUser, conversationDocObj),
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

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('send-message')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    try {
      const result = await this.firebase.firestore
        .collection(this.conversationCollection)
        .where(
          Filter.and(
            Filter.where('roomId', '==', data.roomId),
            Filter.where('id', '==', data.conversationId),
          ),
        )
        .get();

      if (!result.empty) {
        const message: MessageObj = {
          id: data.message.id,
          userId: data.message.userId,
          text: data.message.text,
          isReaded: data.message.isReaded,
          status: MessageStatus.SUCCESS,
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

        data.message.status = MessageStatus.SUCCESS;

        this.wss.emit(data.roomId, data);
      } else {
        throw new Error('No document was found.');
      }
    } catch (error) {
      this.wss
        .to(client.id)
        .emit('fail-send-message', new InternalServerErrorException(error));
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('make-rooms')
  makeRooms(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MakeRoomIdsDto,
  ) {
    client.join(data.roomIds);
  }

  @SubscribeMessage('typing-text')
  typingText(client: Socket, data: SocketPayloadType<TypingTextObj>) {
    client.broadcast.to(data.payload.roomId).emit('typing-text', data.payload);
  }

  @SubscribeMessage('stoping-text')
  stopingText(client: Socket, data: SocketPayloadType<StopingTextObj>) {
    client.broadcast.to(data.payload.roomId).emit('stoping-text', data.payload);
  }
}
