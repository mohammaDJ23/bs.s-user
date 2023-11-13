import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Socket as Sckt, Server } from 'socket.io';
import { EncryptedUserObj } from 'src/types';

export interface Socket extends Sckt {
  user: EncryptedUserObj;
}

export class AuthAdapter extends IoAdapter {
  private jwtService: JwtService;

  constructor(app: INestApplication) {
    super(app);
    app.resolve(JwtService).then((jwtService) => {
      this.jwtService = jwtService;
    });
  }

  createIOServer(port: number, options?: any): Server {
    const server: Server = super.createIOServer(port, options);
    const unAuthorizedError = new UnauthorizedException('Unauthorized');

    server.use((socket: Socket, next) => {
      const bearerToken = socket.handshake.headers.authorization;

      if (bearerToken) {
        const [_, token] = bearerToken.split(' ');
        this.jwtService
          .verifyAsync(token)
          .then((user) => {
            socket.user = user;
            next();
          })
          .catch((reason) => next(unAuthorizedError));
      } else next(unAuthorizedError);
    });

    return server;
  }
}
