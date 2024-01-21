import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { WsException } from 'src/exceptions';
import { UserService } from 'src/services';
import { Socket } from 'src/types';

@Injectable()
export class JwtSocketGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const webSocket = context.switchToWs();
    const socket = webSocket.getClient<Socket>();
    const bearerToken = socket.handshake.headers.authorization;
    const error = new WsException('authentication', 'Unauthorized');

    if (bearerToken) {
      const [_, token] = bearerToken.split(' ');
      return this.jwtService
        .verifyAsync(token)
        .then((user) => this.userService.findByIdOrFail(user.id))
        .then((user) => {
          if (!user) {
            throw error;
          }

          socket.user = user;
          return true;
        })
        .catch((reason) => {
          throw error;
        });
    }

    throw error;
  }
}
