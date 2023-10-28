import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { CACHE_MANAGER, Inject, UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtSocketGuard } from 'src/guards';
import { CustomSocket } from 'src/adapters';
import { Cache } from 'cache-manager';
import { CacheKeys } from 'src/types';
import { Cron, CronExpression } from '@nestjs/schedule';

type UsersStatusType = Record<number, CustomSocket['user']>;

type CachedUsersStatusType = Record<string, UsersStatusType>;

@WebSocketGateway({
  path: '/api/v1/user/socket/connection',
  cors: { origin: process.env.CLIENT_CONTAINER_URL },
})
@UseGuards(JwtSocketGuard)
export class UserConnectionGateWay
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private wss: Server;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheService: Cache) {}

  getCacheKey() {
    return CacheKeys.USERS_STATUS;
  }

  async getCachedData(): Promise<CachedUsersStatusType> {
    const cacheKey = this.getCacheKey();
    return (await this.cacheService.get<CachedUsersStatusType>(cacheKey)) || {};
  }

  async cacheData(data: CachedUsersStatusType): Promise<void> {
    const cacheKey = this.getCacheKey();
    await this.cacheService.set(cacheKey, data);
  }

  async getCachedUsersStatus(): Promise<UsersStatusType> {
    const cacheKey = this.getCacheKey();
    const cachedData = await this.getCachedData();
    if (!cachedData[cacheKey]) {
      cachedData[cacheKey] = {};
    }
    return cachedData[cacheKey];
  }

  async cacheUsersStatus(data: UsersStatusType): Promise<void> {
    const cacheKey = this.getCacheKey();
    const newData = { [cacheKey]: data };
    await this.cacheData(newData);
  }

  async handleConnection(client: CustomSocket) {
    const usersStatus = await this.getCachedUsersStatus();

    usersStatus[client.user.id] = Object.assign(client.user, {
      lastConnection: null,
    });
    await this.cacheUsersStatus(usersStatus);

    this.emitUsersStatuEvent(usersStatus);
  }

  async handleDisconnect(client: CustomSocket) {
    const usersStatus = await this.getCachedUsersStatus();

    usersStatus[client.user.id] = Object.assign(client.user, {
      lastConnection: new Date().toISOString(),
    });
    await this.cacheUsersStatus(usersStatus);

    this.emitUsersStatuEvent(usersStatus);
  }

  @SubscribeMessage('users_status')
  async usersStatusSubscription() {
    const usersStatus = await this.getCachedUsersStatus();
    return { event: 'users_status', data: usersStatus };
  }

  emitUsersStatuEvent(data: UsersStatusType) {
    this.wss.emit('users_status', data);
  }

  @Cron(CronExpression.EVERY_WEEK)
  async removeUsersStatus(): Promise<void> {
    console.log('removing the user status', new Date());
    const oneWeekMilisecond = 604800000;
    const usersStatus = await this.getCachedUsersStatus();
    for (const userStatus in usersStatus) {
      if (
        usersStatus[userStatus].lastConnection &&
        new Date(usersStatus[userStatus].lastConnection).getTime() <=
          new Date().getTime() - oneWeekMilisecond
      ) {
        delete usersStatus[userStatus];
      }
    }
    await this.cacheUsersStatus(usersStatus);
    this.emitUsersStatuEvent(usersStatus);
  }
}
