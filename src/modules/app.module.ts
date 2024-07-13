import { CacheModule, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  UserService,
  RabbitmqService,
  JwtService,
  UserConnectionService,
} from '../services';
import { User } from '../entities';
import { CustomNamingStrategy, JwtStrategy } from '../strategies';
import {
  AllExceptionFilter,
  HttpExceptionFilter,
  RpcExceptionFilter,
  ObjectExceptionFilter,
  QueryExceptionFilter,
} from '../filters';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UserMessagePatternController, userController } from '../controllers';
import { ChatGateWay, UserConnectionGateWay } from 'src/gateways';
import { redisStore } from 'cache-manager-redis-yet';
import {
  CreateUserTransaction,
  DeleteUserByOwnerTransaction,
  DeleteUserTransaction,
  RestoreUserTransaction,
  UpdateUserByOwnerTransaction,
  UpdateUserTransaction,
} from 'src/transactions';
import { ScheduleModule } from '@nestjs/schedule';
import { FirebaseModule } from 'nestjs-firebase';
import { join } from 'path';

@Module({
  imports: [
    FirebaseModule.forRoot({
      googleApplicationCredential: join(
        __dirname,
        '../',
        'firebase.config.json',
      ),
    }),
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      useFactory: async () => ({
        isGlobal: true,
        store: await redisStore({
          url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
          password: process.env.REDIS_PASSWORD,
          username: 'default',
        }),
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      }),
    }),
    ClientsModule.register([
      {
        name: process.env.BANK_RABBITMQ_SERVICE,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: process.env.BANK_RABBITMQ_QUEUE,
          queueOptions: {
            durable: true,
          },
          noAck: false,
        },
      },
      {
        name: process.env.NOTIFICATION_RABBITMQ_SERVICE,
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: process.env.NOTIFICATION_RABBITMQ_QUEUE,
          queueOptions: {
            durable: true,
          },
          noAck: false,
        },
      },
    ]),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DATABASE_HOST,
        port: +process.env.DATABASE_PORT,
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        namingStrategy: new CustomNamingStrategy(),
        entities: [User],
        synchronize: process.env.NODE_ENV === 'development',
      }),
    }),
    TypeOrmModule.forFeature([User]),
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV}`,
      isGlobal: true,
    }),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRATION },
    }),
  ],
  controllers: [userController, UserMessagePatternController],
  providers: [
    UserService,
    JwtService,
    JwtStrategy,
    RabbitmqService,
    UserConnectionService,
    RestoreUserTransaction,
    DeleteUserTransaction,
    DeleteUserByOwnerTransaction,
    UpdateUserTransaction,
    UpdateUserByOwnerTransaction,
    CreateUserTransaction,
    { provide: APP_FILTER, useClass: AllExceptionFilter },
    { provide: APP_FILTER, useClass: ObjectExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: RpcExceptionFilter },
    { provide: APP_FILTER, useClass: QueryExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
      }),
    },
    UserConnectionGateWay,
    ChatGateWay,
  ],
})
export class AppModule {}
