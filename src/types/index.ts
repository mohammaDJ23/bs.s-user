import { Request as Req } from 'express';
import { CreateUserDto } from 'src/dtos';
import { User } from 'src/entities';
import { RequestOptions } from 'web-push';

export interface CurrentUserObj {
  currentUser: User;
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

export interface UpdatedUserPartialObj extends Partial<User> {
  id: number;
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
}

export interface CacheKeyOptions {
  isUnique?: boolean;
}

export interface CacheKeyMetadata {
  key: CacheKeys;
  options: CacheKeyOptions;
}

export interface RestoreUserObj {
  id: number;
  user: User;
}

export interface DeleteUserObj {
  id: number;
  user: User;
}

export interface UpdateUserObj extends Partial<CurrentUserObj> {
  payload: Partial<User>;
  user: User;
}

export interface CreateUserObj extends CurrentUserObj {
  payload: CreateUserDto;
}

export interface NotificationObj {
  payload?: string;
  requestOptions?: RequestOptions;
}
