import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './modules';
import { swagger } from './libs';
import { AuthAdapter } from './adapters';
import './libs/typeormOverwrites';

require('dotenv').config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: process.env.USER_RABBITMQ_QUEUE,
      queueOptions: {
        durable: true,
      },
      noAck: false,
    },
  });

  app.enableCors({ origin: '*' });
  swagger(app);
  app.useWebSocketAdapter(new AuthAdapter(app));
  await app.startAllMicroservices();
  await app.listen(process.env.PORT);
}
bootstrap();
