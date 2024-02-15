import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as JwService } from '@nestjs/jwt';
import { User } from 'src/entities';
import { EncryptedUserObj, Socket } from 'src/types';
import { UserService } from './user.service';

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: JwService,
    private readonly userService: UserService,
  ) {}

  async decodeToken(client: Socket): Promise<EncryptedUserObj> {
    const bearerToken = client.handshake.headers.authorization;

    if (bearerToken && typeof bearerToken === 'string') {
      const [_, token] = bearerToken.split(' ');
      return this.jwtService.verifyAsync<EncryptedUserObj>(token);
    }

    throw new UnauthorizedException();
  }

  async verify(client: Socket): Promise<User | null> {
    const decodedToken = await this.decodeToken(client);
    return this.userService.findByIdOrFail(decodedToken.id);
  }

  async verifyWithDeleted(client: Socket): Promise<User | null> {
    const decodedToken = await this.decodeToken(client);
    return this.userService.findByIdOrFailWithDeleted(decodedToken.id);
  }
}
