import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from 'src/exceptions';
import { JwtService } from 'src/services';
import { Socket } from 'src/types';

@Injectable()
export class JwtSocketGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const webSocket = context.switchToWs();
    const socket = webSocket.getClient<Socket>();

    try {
      const user = await this.jwtService.verify(socket);

      if (!user) {
        throw new Error();
      }

      socket.user = user;
      return true;
    } catch (error) {
      throw new WsException('authentication', 'Unauthorized');
    }
  }
}
