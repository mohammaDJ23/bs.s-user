import { ValidationPipe } from '@nestjs/common';
import { WsException } from 'src/exceptions';

export class WsValidationPipe extends ValidationPipe {
  constructor(protected readonly event: string) {
    super({
      exceptionFactory(errors) {
        return new WsException(
          this.event,
          errors.map((error) => Object.values(error.constraints)).join(', '),
        );
      },
    });
  }
}
