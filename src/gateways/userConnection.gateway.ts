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
  UseFilters,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtSocketGuard } from 'src/guards';
import { Cache } from 'cache-manager';
import { CacheKeys, Socket, UserRoles } from 'src/types';
import { InitialUserStatusDto, LogoutUserDto, UsersStatusDto } from 'src/dtos';
import { User } from 'src/entities';
import { WsValidationPipe } from 'src/pipes/ws.pipe';
import { WsFilter } from 'src/filters';
import { WsException } from 'src/exceptions';
import { JwtService } from 'src/services';

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

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheService: Cache,
    private readonly jwtService: JwtService,
  ) {}

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
    try {
      const user = await this.jwtService.verify(client);
      if (!user) {
        client.disconnect();
      } else {
        let userStatus = await this.getUserStatus(user.id);
        userStatus = Object.assign<User, Partial<UserStatusType>>(user, {
          lastConnection: null,
        });
        await this.setUserStatus(userStatus);
        this.emitUserStatusToAll(
          this.convertUserStatusToUsersStatus(userStatus),
        );
      }
    } catch (error) {}
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    try {
      let userStatus = await this.getUserStatus(client.user.id);
      userStatus = Object.assign<User, Partial<UserStatusType>>(client.user, {
        lastConnection: new Date().toISOString(),
      });
      await this.setUserStatus(userStatus);
      this.emitUserStatusToAll(this.convertUserStatusToUsersStatus(userStatus));
    } catch (error) {}
  }

  @UsePipes(new WsValidationPipe('initial-user-status'))
  @UseFilters(WsFilter)
  @UseGuards(JwtSocketGuard)
  @SubscribeMessage('initial-user-status')
  async initialUserStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: InitialUserStatusDto,
  ) {
    try {
      if (client.user.role === UserRoles.OWNER) {
        const findedUserStatus: UserStatusType | undefined =
          await this.getUserStatus(data.id);

        let userStatus: UsersStatusType | object;
        if (!findedUserStatus) {
          userStatus = {};
        } else {
          userStatus = this.convertUserStatusToUsersStatus(findedUserStatus);
        }

        client.emit('initial-user-status', userStatus);
      }
    } catch (error) {
      throw new WsException('initial-user-status', error.message);
    }
  }

  @UsePipes(new WsValidationPipe('users-status'))
  @UseFilters(WsFilter)
  @UseGuards(JwtSocketGuard)
  @SubscribeMessage('users-status')
  async usersStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UsersStatusDto,
  ) {
    try {
      if (client.user.role === UserRoles.OWNER) {
        const cachedUsersStatus = await Promise.all(
          data.ids.map((id) => this.getUserStatus(id)),
        );
        const usersStatus = cachedUsersStatus
          .filter(
            (userStatus: UserStatusType | undefined) =>
              userStatus && userStatus,
          )
          .reduce((acc, val) => {
            acc = Object.assign(acc, this.convertUserStatusToUsersStatus(val));
            return acc;
          }, {} as UsersStatusType);
        client.emit('users-status', usersStatus);
      }
    } catch (error) {
      throw new WsException('users-status', error.message);
    }
  }

  @UsePipes(new WsValidationPipe('logout-user'))
  @UseFilters(WsFilter)
  @UseGuards(JwtSocketGuard)
  @SubscribeMessage('logout-user')
  async logoutUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LogoutUserDto,
  ) {
    try {
      if (client.user.role === UserRoles.OWNER) {
        const userStatus: UserStatusType | undefined = await this.getUserStatus(
          data.id,
        );
        if (userStatus && userStatus.lastConnection === null) {
          this.wss.emit(
            'logout-user',
            this.convertUserStatusToUsersStatus(userStatus),
          );
        }
      }
    } catch (error) {
      throw new WsException('logout-user', error.message);
    }
  }
}
