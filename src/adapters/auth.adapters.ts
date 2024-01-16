import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Socket as Sckt, Server } from 'socket.io';
import { User } from 'src/entities';
import { UserService } from 'src/services';
import { EncryptedUserObj } from 'src/types';

export interface Socket extends Sckt {
  user: User;
}

export class AuthAdapter extends IoAdapter {
  private jwtService: JwtService;
  private userService: UserService;

  constructor(app: INestApplication) {
    super(app);
    app.resolve(JwtService).then((jwtService) => {
      this.jwtService = jwtService;
    });
    app.resolve(UserService).then((userService) => {
      this.userService = userService;
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
          .then(async (user: EncryptedUserObj) => {
            const findedUser = await this.userService.findByIdOrFail(user.id);
            socket.user = findedUser;
            next();
          })
          .catch((reason) => next(unAuthorizedError));
      } else next(unAuthorizedError);
    });

    return server;
  }
}
