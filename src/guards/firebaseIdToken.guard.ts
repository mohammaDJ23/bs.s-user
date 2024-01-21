import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';
import { Observable } from 'rxjs';
import { WsException } from 'src/exceptions';
import { UserService } from 'src/services';
import { Socket } from 'src/types';

@Injectable()
export class FirebaseIdTokenGuard implements CanActivate {
  constructor(
    @InjectFirebaseAdmin() private readonly firebase: FirebaseAdmin,
    private readonly userService: UserService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const webSocket = context.switchToWs();
    const socket = webSocket.getClient<Socket>();
    const bearerToken = socket.handshake.headers.fbitauthorization as string;
    const error = new WsException('authentication', 'Unauthorized');

    if (bearerToken && typeof bearerToken === 'string') {
      const [_, token] = bearerToken.split(' ');
      return this.firebase.auth
        .verifyIdToken(token)
        .then((user) => this.userService.findById(+user.uid))
        .then((user) => {
          if (!user) {
            throw error;
          }

          socket.firebaseUser = user;
          return true;
        })
        .catch((reason) => {
          throw error;
        });
    }

    throw error;
  }
}
