import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException as WebSocketException,
} from '@nestjs/websockets';
import { Inject, UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Server } from 'socket.io';
import { plainToClass } from 'class-transformer';
import { v4 as uuid } from 'uuid';
import { FirebaseIdTokenGuard, JwtSocketGuard } from 'src/guards';
import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';
import { FieldValue, Filter } from '@google-cloud/firestore';
import { User } from 'src/entities';
import { JwtService, UserConnectionService, UserService } from 'src/services';
import { getConversationTargetId } from 'src/libs/conversationTargetId';
import {
  MakeRoomIdsDto,
  MessageObj,
  MessageStatus,
  SendMessageDto,
  StartConversationDto,
  TypingTextDto,
  UserDto,
} from 'src/dtos';
import { WsFilter } from 'src/filters';
import { WsException } from 'src/exceptions';
import { WsValidationPipe } from 'src/pipes';
import { NotificationPayloadObj, Socket, UserObj, UserRoles } from 'src/types';
import { ClientProxy } from '@nestjs/microservices';

export interface CreatedMessagePayloadObj extends UserObj {
  message: MessageObj;
  targetUser: User;
}

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

@WebSocketGateway({
  path: '/api/v1/user/socket/chat',
  cors: {
    origin: [
      process.env.CLIENT_CONTAINER_URL,
      process.env.CLIENT_AUTH_URL,
      process.env.CLIENT_BANK_URL,
      process.env.CLIENT_CHAT_URL,
    ],
  },
})
export class ChatGateWay implements OnGatewayConnection {
  @WebSocketServer()
  private wss: Server;
  private conversationCollection: string =
    process.env.FIREBASE_CONVERSATION_COLLECTION!;

  constructor(
    @InjectFirebaseAdmin() private readonly firebase: FirebaseAdmin,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly userConnectionService: UserConnectionService,
    @Inject(process.env.NOTIFICATION_RABBITMQ_SERVICE)
    private readonly notificationClientProxy: ClientProxy,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const user = await this.jwtService.verify(client);
      if (!user) {
        client.disconnect();
      }
    } catch (error) {
      client.disconnect();
    }
  }

  getCreatorRoomId(creator: User, target: User) {
    return `${creator.id}.${target.id}`;
  }

  getTargetRoomId(target: User, creator: User) {
    return `${target.id}.${creator.id}`;
  }

  async createNewConversation(client: Socket, data: StartConversationDto) {
    const user = await this.userService.findByIdOrFail(data.id);

    if (
      (client.user.role !== UserRoles.OWNER && user.role === UserRoles.OWNER) ||
      client.user.role === UserRoles.OWNER
    ) {
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

      return new Conversation(plainUser, conversationDocObj);
    } else {
      throw new WebSocketException('Could not start a conversation.');
    }
  }

  @UsePipes(new WsValidationPipe('start-conversation'))
  @UseFilters(WsFilter)
  @UseGuards(JwtSocketGuard, FirebaseIdTokenGuard)
  @SubscribeMessage('start-conversation')
  async startConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartConversationDto,
  ) {
    try {
      const conversation = await this.createNewConversation(client, data);
      client.emit('start-conversation', conversation);
    } catch (error) {
      throw new WsException('start-conversation', error.message);
    }
  }

  @UsePipes(new WsValidationPipe('start-conversation-with-ack'))
  @UseFilters(WsFilter)
  @UseGuards(JwtSocketGuard, FirebaseIdTokenGuard)
  @SubscribeMessage('start-conversation-with-ack')
  async startConversationWithAck(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartConversationDto,
  ) {
    try {
      return await this.createNewConversation(client, data);
    } catch (error) {
      throw new WsException('start-conversation-with-ack', error.message);
    }
  }

  @UsePipes(new WsValidationPipe('send-message'))
  @UseFilters(WsFilter)
  @UseGuards(JwtSocketGuard, FirebaseIdTokenGuard)
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

        const targetUserId = getConversationTargetId(
          client.user,
          conversationDocData,
        );

        batch.update(conversationDocRef, {
          contributors: FieldValue.arrayUnion(targetUserId),
          lastMessage: message,
          updatedAt: FieldValue.serverTimestamp(),
        });

        batch.set(messageDocRef, message);

        await batch.commit();

        data.message.status = MessageStatus.SUCCESS;

        this.wss.emit(data.roomId, data);

        try {
          const userStatus = await this.userConnectionService.getUserStatus(
            targetUserId,
          );

          if (userStatus && userStatus.lastConnection) {
            await this.notificationClientProxy
              .emit<string, NotificationPayloadObj<CreatedMessagePayloadObj>>(
                'created_message_notification',
                {
                  payload: {
                    data: {
                      targetUser: plainToClass(
                        UserDto,
                        userStatus,
                      ) as unknown as User,
                      user: plainToClass(
                        UserDto,
                        client.user,
                      ) as unknown as User,
                      message,
                    },
                  },
                  user: client.user,
                },
              )
              .toPromise();
          }
        } catch (error) {}
      } else {
        throw new WebSocketException('No document was found.');
      }
    } catch (error) {
      throw new WsException('send-message', error.message);
    }
  }

  @UsePipes(new WsValidationPipe('make-rooms'))
  @UseFilters(WsFilter)
  @UseGuards(JwtSocketGuard, FirebaseIdTokenGuard)
  @SubscribeMessage('make-rooms')
  makeRooms(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MakeRoomIdsDto,
  ) {
    client.join(data.roomIds);
  }

  @UsePipes(new WsValidationPipe('typing-text'))
  @UseFilters(WsFilter)
  @SubscribeMessage('typing-text')
  typingText(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingTextDto,
  ) {
    client.broadcast.to(data.roomId).emit('typing-text', data);
  }

  @UsePipes(new WsValidationPipe('stoping-text'))
  @UseFilters(WsFilter)
  @SubscribeMessage('stoping-text')
  stopingText(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingTextDto,
  ) {
    client.broadcast.to(data.roomId).emit('stoping-text', data);
  }
}
