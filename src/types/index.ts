import { Request as Req } from 'express';
import { User } from 'src/entities';
import { RequestOptions } from 'web-push';
import { Socket as Sckt } from 'socket.io';
import { IncomingMessage as IncMessage } from 'http';

export interface CurrentUserObj {
  currentUser: User;
}

export interface UserObj {
  user: User;
}

export interface EncryptedUserObj {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  expiration: number;
}

export enum UserRoles {
  OWNER = 'owner',
  ADMIN = 'admin',
  USER = 'user',
}

export interface PartialUser extends Partial<User> {
  id: number;
}

export interface UpdatedUserPartialObj {
  payload: PartialUser;
}

export interface FindUserByEmailObj {
  payload: Pick<PartialUser, 'email'>;
}

export interface FindUserByIdObj {
  payload: Pick<PartialUser, 'id'>;
}

export interface Request extends Req, CurrentUserObj {}

export type Exception =
  | {
      message: string;
      statusCode: number;
      error: string;
    }
  | string;

export interface ClassConstructor {
  new (...args: any[]): {};
}

export interface DtoConstructor {
  readonly construct: ClassConstructor;
}

export class SerialConstructor implements DtoConstructor {
  constructor(readonly construct: ClassConstructor) {}
}

export class ListSerial extends SerialConstructor {}

export class ArraySerial extends SerialConstructor {}

export class ObjectSerial extends SerialConstructor {}

export type ListObj = [any[], number];

export enum CacheKeys {
  USERS = 'USERS',
  USER = 'USER',
  DELETED_USERS = 'DELETED_USERS',
  DELETED_USER = 'DELETED_USER',
  QUANTITIES = 'QUANTITIES',
  DELETED_QUANTITIES = 'DELETED_QUANTITIES',
  USERS_STATUS = 'USERS_STATUS',
}

export interface CacheKeyOptions {
  isUnique?: boolean;
}

export interface CacheKeyMetadata {
  key: CacheKeys;
  options: CacheKeyOptions;
}

export interface NotificationPayloadObj<T = {}> extends UserObj {
  payload: {
    data: T;
    options?: RequestOptions;
  };
}

interface FirebaseUserObj {
  firebaseUser: User;
}

export interface Socket extends Sckt, UserObj, FirebaseUserObj {}

export interface IncommingMessage extends IncMessage {
  user: User;
}
