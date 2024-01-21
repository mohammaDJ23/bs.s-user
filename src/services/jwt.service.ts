import { Injectable } from '@nestjs/common';
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

  async verify(client: Socket): Promise<User | null> {
    const bearerToken = client.handshake.headers.authorization;

    if (bearerToken && typeof bearerToken === 'string') {
      const [_, token] = bearerToken.split(' ');
      const decodedToken = await this.jwtService.verifyAsync<EncryptedUserObj>(
        token,
      );
      return this.userService.findByIdOrFail(decodedToken.id);
    }

    return null;
  }
}
