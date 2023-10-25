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

@WebSocketGateway({
  path: '/socket/user-connection',
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

  async handleConnection(client: CustomSocket) {
    const cacheKey = this.getCacheKey();
    let cachedData: Record<
      string,
      Record<number, CustomSocket['user']>
    > = (await this.cacheService.get(cacheKey)) || {};

    if (!cachedData[cacheKey]) {
      cachedData[cacheKey] = {};
    }

    cachedData[cacheKey][client.user.id] = Object.assign(client.user, {
      lastConnection: null,
    });
    await this.cacheService.set(cacheKey, cachedData);

    this.wss.emit('users_status', cachedData[cacheKey]);
  }

  async handleDisconnect(client: CustomSocket) {
    const cacheKey = this.getCacheKey();
    let cachedData: Record<
      string,
      Record<number, CustomSocket['user']>
    > = await this.cacheService.get(cacheKey);

    if (cachedData[cacheKey][client.user.id]) {
      cachedData[cacheKey][client.user.id] = Object.assign(client.user, {
        lastConnection: new Date().toISOString(),
      });
      await this.cacheService.set(cacheKey, cachedData);
    }

    this.wss.emit('users_status', cachedData[cacheKey]);
  }

  @SubscribeMessage('users_status')
  async usersStatus() {
    const cacheKey = this.getCacheKey();
    const cachedData = await this.cacheService.get(cacheKey);
    return { event: 'users_status', data: cachedData[cacheKey] };
  }
}
