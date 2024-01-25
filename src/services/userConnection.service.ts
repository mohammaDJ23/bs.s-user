import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { CacheKeys, Socket } from 'src/types';
import { Cache } from 'cache-manager';

export type UserStatusType = Socket['user'] & {
  lastConnection?: string | null;
};

export type UsersStatusType = Record<number, UserStatusType>;

@Injectable()
export class UserConnectionService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheService: Cache) {}

  getCacheKey(id: number) {
    return `${CacheKeys.USERS_STATUS}.${process.env.PORT}.${id}`;
  }

  getTtl(): number {
    // 6 month
    return 15778476000;
  }

  getUserStatus(id: number): Promise<UserStatusType | undefined> {
    const cacheKey = this.getCacheKey(id);
    return this.cacheService.get(cacheKey);
  }

  async setUserStatus(user: UserStatusType): Promise<void> {
    const cacheKey = this.getCacheKey(user.id);
    const ttl = this.getTtl();
    await this.cacheService.set(cacheKey, user);
  }

  convertUserStatusToUsersStatus(user: UserStatusType): UsersStatusType {
    return { [user.id]: user };
  }
}
