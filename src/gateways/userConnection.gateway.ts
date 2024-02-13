import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtSocketGuard } from 'src/guards';
import { Socket, UserRoles } from 'src/types';
import {
  InitialUserStatusDto,
  LogoutUserDto,
  UserConnectionStatusDto,
  UserDto,
  UsersStatusDto,
} from 'src/dtos';
import { User } from 'src/entities';
import { WsValidationPipe } from 'src/pipes/ws.pipe';
import { WsFilter } from 'src/filters';
import { WsException } from 'src/exceptions';
import {
  ConnectionStatusObj,
  JwtService,
  UserConnectionService,
  UsersStatusType,
} from 'src/services';

@WebSocketGateway({
  path: '/api/v1/user/socket/connection',
  cors: {
    origin: [
      process.env.CLIENT_CONTAINER_URL,
      process.env.CLIENT_AUTH_URL,
      process.env.CLIENT_BANK_URL,
      process.env.CLIENT_CHAT_URL,
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
    private readonly jwtService: JwtService,
    private readonly userConnectionService: UserConnectionService,
  ) {}

  emitUserStatusToAll(user: UsersStatusType): void {
    this.wss.emit('user-status', user);
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const user = (await this.jwtService.verify(client)) as unknown as UserDto;
      if (!user) {
        client.disconnect();
      } else {
        let userStatus =
          (await this.userConnectionService.getUserStatus(user.id)) ||
          ({} as UserConnectionStatusDto);

        const userAgents = client.handshake.headers['user-agent'];

        userStatus = Object.assign<UserDto, ConnectionStatusObj>(user, {
          lastConnection: null,
          agents: Object.assign(userStatus.agents || {}, {
            [userAgents]: userAgents,
          }),
        });

        await this.userConnectionService.setUserStatus(userStatus);

        this.emitUserStatusToAll(
          this.userConnectionService.convertUserStatusToUsersStatus(userStatus),
        );
      }
    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(@ConnectedSocket() client: Socket) {
    try {
      const user = await this.jwtService.verify(client);
      if (!user) {
        client.disconnect();
      } else {
        let userStatus = await this.userConnectionService.getUserStatus(
          user.id,
        );

        delete userStatus.agents[client.handshake.headers['user-agent']];

        if (Object.keys(userStatus.agents).length <= 0) {
          userStatus.lastConnection = new Date().toISOString();
        }

        await this.userConnectionService.setUserStatus(userStatus);
        this.emitUserStatusToAll(
          this.userConnectionService.convertUserStatusToUsersStatus(userStatus),
        );
      }
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
        const findedUserStatus: UserConnectionStatusDto | undefined =
          await this.userConnectionService.getUserStatus(data.id);

        let userStatus: UsersStatusType;
        if (!findedUserStatus) {
          userStatus = {};
        } else {
          userStatus =
            this.userConnectionService.convertUserStatusToUsersStatus(
              findedUserStatus,
            );
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
          data.ids.map((id) => this.userConnectionService.getUserStatus(id)),
        );
        const usersStatus = cachedUsersStatus
          .filter(
            (userStatus: UserConnectionStatusDto | undefined) =>
              userStatus && userStatus,
          )
          .reduce((acc, val) => {
            acc = Object.assign(
              acc,
              this.userConnectionService.convertUserStatusToUsersStatus(val),
            );
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
        const userStatus: UserConnectionStatusDto | undefined =
          await this.userConnectionService.getUserStatus(data.id);
        if (userStatus && userStatus.lastConnection === null) {
          this.wss.emit(
            'logout-user',
            this.userConnectionService.convertUserStatusToUsersStatus(
              userStatus,
            ),
          );
        }
      }
    } catch (error) {
      throw new WsException('logout-user', error.message);
    }
  }
}
