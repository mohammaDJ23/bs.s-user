import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { CACHE_MANAGER, Inject, UseGuards } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtSocketGuard } from 'src/guards';
import { CustomSocket } from 'src/adapters';
import { Cache } from 'cache-manager';

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
    return 'user-status';
  }

  async handleConnection(client: CustomSocket) {
    try {
      const cacheKey = this.getCacheKey();
      let cachedData = (await this.cacheService.get(cacheKey)) || {};
      if (!cachedData[cacheKey]) {
        cachedData[cacheKey] = {};
      }
      if (!cachedData[cacheKey][client.user.id]) {
        cachedData[cacheKey][client.user.id] = client.user;
        await this.cacheService.set(cacheKey, cachedData);
      }
      this.wss.emit('users_status', cachedData);
    } catch (error) {
      console.error(error);
    }
  }

  async handleDisconnect(client: CustomSocket) {
    try {
      const cacheKey = this.getCacheKey();
      let cachedData = await this.cacheService.get(cacheKey);
      if (cachedData[cacheKey][client.user.id]) {
        delete cachedData[cacheKey][client.user.id];
        await this.cacheService.set(cacheKey, cachedData);
      }
      this.wss.emit('users_status', cachedData);
    } catch (error) {
      console.error(error);
    }
  }
}
