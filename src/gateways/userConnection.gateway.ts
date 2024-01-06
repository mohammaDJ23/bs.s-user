import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import {
  CACHE_MANAGER,
  Inject,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtSocketGuard } from 'src/guards';
import { Socket } from 'src/adapters';
import { Cache } from 'cache-manager';
import {
  CacheKeys,
  EncryptedUserObj,
  SocketPayloadType,
  UserRoles,
} from 'src/types';
import { InitialUserStatusDto, UsersStatusDto } from 'src/dtos';

type UserStatusType = Socket['user'] & {
  lastConnection?: string | null;
};

type UsersStatusType = Record<number, UserStatusType>;

@WebSocketGateway({
  path: '/api/v1/user/socket/connection',
  cors: {
    origin: [
      process.env.CLIENT_CONTAINER_URL,
      process.env.CLIENT_AUTH_URL,
      process.env.CLIENT_BANK_URL,
    ],
  },
})
@UseGuards(JwtSocketGuard)
export class UserConnectionGateWay
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private wss: Server;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheService: Cache) {}

  getCacheKey(id: number) {
    return `${CacheKeys.USERS_STATUS}.${process.env.PORT}.${id}`;
  }

  getTtl(): number {
    // 6 month
    return 15778476000;
  }

  getUserStatus(id: number): Promise<UserStatusType | undefined> {
    const cacheKey = this.getCacheKey(id);
    return this.cacheService.get(cacheKey);
  }

  async setUserStatus(user: UserStatusType): Promise<void> {
    const cacheKey = this.getCacheKey(user.id);
    const ttl = this.getTtl();
    await this.cacheService.set(cacheKey, user, ttl);
  }

  convertUserStatusToUsersStatus(user: UserStatusType): UsersStatusType {
    return { [user.id]: user };
  }

  emitUserStatusToAll(user: UsersStatusType): void {
    this.wss.emit('user-status', user);
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    let userStatus = await this.getUserStatus(client.user.id);

    userStatus = Object.assign<EncryptedUserObj, Partial<UserStatusType>>(
      client.user,
      { lastConnection: null },
    );

    await this.setUserStatus(userStatus);

    this.emitUserStatusToAll(this.convertUserStatusToUsersStatus(userStatus));
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    let userStatus = await this.getUserStatus(client.user.id);

    userStatus = Object.assign<EncryptedUserObj, Partial<UserStatusType>>(
      client.user,
      { lastConnection: new Date().toISOString() },
    );

    await this.setUserStatus(userStatus);

    this.emitUserStatusToAll(this.convertUserStatusToUsersStatus(userStatus));
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('initial-user-status')
  async initialUserStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: InitialUserStatusDto,
  ) {
    if (client.user.role === UserRoles.OWNER) {
      const findedUserStatus: UserStatusType | undefined =
        await this.getUserStatus(data.id);

      let userStatus: UsersStatusType | object;
      if (!findedUserStatus) {
        userStatus = {};
      } else {
        userStatus = this.convertUserStatusToUsersStatus(findedUserStatus);
      }

      this.wss.to(client.id).emit('initial-user-status', userStatus);
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('users-status')
  async usersStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UsersStatusDto,
  ) {
    if (client.user.role === UserRoles.OWNER) {
      const cachedUsersStatus = await Promise.all(
        data.ids.map((id) => this.getUserStatus(id)),
      );
      const usersStatus = cachedUsersStatus
        .filter(
          (userStatus: UserStatusType | undefined) => userStatus && userStatus,
        )
        .reduce((acc, val) => {
          acc = Object.assign(acc, this.convertUserStatusToUsersStatus(val));
          return acc;
        }, {} as UsersStatusType);
      this.wss.to(client.id).emit('users-status', usersStatus);
    }
  }

  @SubscribeMessage('logout-user')
  async logoutUser(client: Socket, data: SocketPayloadType<number>) {
    if (client.user.role === UserRoles.OWNER) {
      const userStatus: UserStatusType | undefined = await this.getUserStatus(
        data.payload,
      );
      if (userStatus) {
        this.wss.emit(
          'logout-user',
          this.convertUserStatusToUsersStatus(userStatus),
        );
      }
    }
  }
}
