import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import {
  CreateUserDto,
  UpdateUserByUserDto,
  UserQuantitiesDto,
  LastWeekDto,
  UpdateUserByOwnerDto,
  DeletedUserDto,
} from '../dtos';
import { User } from '../entities';
import { hash } from 'bcryptjs';
import { ClientProxy, RmqContext, RpcException } from '@nestjs/microservices';
import { UserRoles, UpdatedUserPartialObj } from '../types';
import { RabbitmqService } from './rabbitmq.service';
import { UserListFiltersDto } from 'src/dtos/userListFilters.dto';
import { DeletedUserListFiltersDto } from 'src/dtos/deletedUserListFilters.dto';
import {
  CreateUserTransaction,
  DeleteUserTransaction,
  RestoreUserTransaction,
  UpdateUserTransaction,
} from 'src/transactions';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @Inject(process.env.USER_RABBITMQ_SERVICE)
    private readonly clientProxy: ClientProxy,
    private readonly rabbitmqService: RabbitmqService,
    @Inject(forwardRef(() => RestoreUserTransaction))
    private readonly restoreUserTransaction: RestoreUserTransaction,
    @Inject(forwardRef(() => DeleteUserTransaction))
    private readonly deleteUserTransaction: DeleteUserTransaction,
    @Inject(forwardRef(() => UpdateUserTransaction))
    private readonly updateUserTransaction: UpdateUserTransaction,
    @Inject(forwardRef(() => CreateUserTransaction))
    private readonly createUserTransaction: CreateUserTransaction,
  ) {}

  async createWithEntityManager(
    payload: CreateUserDto,
    currentUser: User,
    manager: EntityManager,
  ): Promise<User> {
    let findedUser = await manager
      .createQueryBuilder(User, 'public.user')
      .withDeleted()
      .where('public.user.email = :email', { email: payload.email })
      .getOne();

    if (findedUser) throw new ConflictException('The user already exist.');

    payload.password = await hash(payload.password, 10);
    let newUser = manager.create(User);
    newUser = Object.assign(newUser, payload);
    newUser.parent = currentUser;
    newUser = await manager.save(newUser);
    return newUser;
  }

  async create(payload: CreateUserDto, currentUser: User): Promise<User> {
    return this.createUserTransaction.run({ payload, currentUser });
  }

  async updateWithEntityManager(
    payload: Partial<User>,
    findedUser: User,
    manager: EntityManager,
  ) {
    if (payload.email !== findedUser.email) {
      const existedUser = await manager
        .createQueryBuilder(User, 'public.user')
        .withDeleted()
        .where('public.user.id != :id')
        .andWhere('public.user.email = :email')
        .setParameters({ id: payload.id, email: payload.email })
        .getOne();

      if (existedUser) {
        throw new BadRequestException('A user exists with the email.');
      }
    }

    const newUser = Object.assign(findedUser, payload, {
      updatedAt: new Date(),
    });
    return manager
      .createQueryBuilder(User, 'public.user')
      .update()
      .set(newUser)
      .where('public.user.id = :id')
      .setParameters({ id: payload.id })
      .returning('*')
      .exe({ noEffectError: 'Could not update the user.' });
  }

  async updateByUser(
    payload: UpdateUserByUserDto,
    currentUser: User,
  ): Promise<User> {
    return this.updateUserTransaction.run({ payload, user: currentUser });
  }

  async updateByOwner(
    payload: UpdateUserByOwnerDto,
    currentUser: User,
  ): Promise<User> {
    if (payload.id === currentUser.id) {
      return this.updateUserTransaction.run({
        payload,
        user: currentUser,
      });
    }

    const user = await this.findByIdOrFail(payload.id);
    return this.updateUserTransaction.run({
      payload,
      user,
      currentUser,
    });
  }

  async updatePartialForMicroservices(
    payload: UpdatedUserPartialObj,
    context: RmqContext,
  ): Promise<User> {
    try {
      const user = await this.findByIdOrFail(payload.id);
      return this.updateUserTransaction.run({ payload, user });
    } catch (error) {
      throw new RpcException(error);
    } finally {
      this.rabbitmqService.applyAcknowledgment(context);
    }
  }

  deleteWithEntityManager(
    deleteUserId: number,
    currentUserId: number,
    entityManager: EntityManager,
  ): Promise<User> {
    return entityManager
      .createQueryBuilder(User, 'public.user')
      .softDelete()
      .where('public.user.id = :deleteUserId')
      .andWhere('public.user.deleted_at IS NULL')
      .andWhere('public.user.created_by = :currentUserId')
      .setParameters({ deleteUserId, currentUserId })
      .returning('*')
      .exe({ noEffectError: 'Could not delete the user.' });
  }

  async delete(id: number, user: User): Promise<User> {
    return this.deleteUserTransaction.run({ id, user });
  }

  async findOne(id: number): Promise<User> {
    return this.findByIdOrFail(id);
  }

  findById(id: number): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .getOne();
  }

  findByIdOrFail(id: number): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id')
      .setParameters({ id })
      .getOneOrFail();
  }

  async findByIdForMicroservices(
    id: number,
    context: RmqContext,
  ): Promise<User> {
    try {
      const user = await this.findByIdOrFail(id);
      return user;
    } catch (error) {
      throw new RpcException(error);
    } finally {
      this.rabbitmqService.applyAcknowledgment(context);
    }
  }

  findByEmail(email: string): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();
  }

  findByEmailWithDeleted(email: string): Promise<User> {
    return this.userRepository
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByEmailForMicroservices(
    email: string,
    context: RmqContext,
  ): Promise<User> {
    try {
      const user = await this.findByEmail(email);
      if (!user) throw new NotFoundException('Could not found the user');
      return user;
    } catch (error) {
      throw new RpcException(error);
    } finally {
      this.rabbitmqService.applyAcknowledgment(context);
    }
  }

  findAll(
    page: number,
    take: number,
    filters: UserListFiltersDto,
  ): Promise<[User[], number]> {
    return this.userRepository
      .createQueryBuilder('user')
      .take(take)
      .skip((page - 1) * take)
      .orderBy('user.createdAt', 'DESC')
      .where(
        new Brackets((query) =>
          query
            .where('to_tsvector(user.firstName) @@ plainto_tsquery(:q)')
            .orWhere('to_tsvector(user.lastName) @@ plainto_tsquery(:q)')
            .orWhere('to_tsvector(user.phone) @@ plainto_tsquery(:q)')
            .orWhere("user.firstName ILIKE '%' || :q || '%'")
            .orWhere("user.lastName ILIKE '%' || :q || '%'")
            .orWhere("user.phone ILIKE '%' || :q || '%'"),
        ),
      )
      .andWhere('user.role = ANY(:roles)')
      .andWhere(
        'CASE WHEN (:fromDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.createdAt)) * 1000, 0)::BIGINT >= (:fromDate)::BIGINT ELSE TRUE END',
      )
      .andWhere(
        'CASE WHEN (:toDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.createdAt)) * 1000, 0)::BIGINT <= (:toDate)::BIGINT ELSE TRUE END',
      )
      .setParameters({
        q: filters.q,
        roles: filters.roles,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      })
      .getManyAndCount();
  }

  getUserQuantities(): Promise<UserQuantitiesDto> {
    return this.userRepository
      .createQueryBuilder('user')
      .select('COALESCE(COUNT(user.id), 0)::INTEGER', 'quantities')
      .addSelect(
        `COALESCE(SUM((user.role = :owner)::INTEGER), 0)::INTEGER`,
        'ownerQuantities',
      )
      .addSelect(
        `COALESCE(SUM((user.role = :admin)::INTEGER), 0)::INTEGER`,
        'adminQuantities',
      )
      .addSelect(
        `COALESCE(SUM((user.role = :user)::INTEGER), 0)::INTEGER`,
        'userQuantities',
      )
      .setParameters({
        owner: UserRoles.OWNER,
        admin: UserRoles.ADMIN,
        user: UserRoles.USER,
      })
      .getRawOne();
  }

  getDeletedUserQuantities(): Promise<UserQuantitiesDto> {
    return this.userRepository
      .createQueryBuilder('user')
      .select('COALESCE(COUNT(user.id), 0)::INTEGER', 'quantities')
      .addSelect(
        `COALESCE(SUM((user.role = :owner)::INTEGER), 0)::INTEGER`,
        'ownerQuantities',
      )
      .addSelect(
        `COALESCE(SUM((user.role = :admin)::INTEGER), 0)::INTEGER`,
        'adminQuantities',
      )
      .addSelect(
        `COALESCE(SUM((user.role = :user)::INTEGER), 0)::INTEGER`,
        'userQuantities',
      )
      .withDeleted()
      .where('user.deletedAt IS NOT NULL')
      .setParameters({
        owner: UserRoles.OWNER,
        admin: UserRoles.ADMIN,
        user: UserRoles.USER,
      })
      .getRawOne();
  }

  lastWeekUsers(): Promise<LastWeekDto[]> {
    return this.userRepository.query(
      `
        WITH lastWeek (date) AS (
          VALUES
            (NOW()),
            (NOW() - INTERVAL '1 DAY'),
            (NOW() - INTERVAL '2 DAY'),
            (NOW() - INTERVAL '3 DAY'),
            (NOW() - INTERVAL '4 DAY'),
            (NOW() - INTERVAL '5 DAY'),
            (NOW() - INTERVAL '6 DAY')
        )
        SELECT
          COALESCE(EXTRACT(EPOCH FROM lastWeek.date) * 1000, 0)::BIGINT AS date,
          COUNT(public.user.created_at)::INTEGER as count
        FROM lastWeek
        FULL JOIN 
          public.user ON to_char(lastWeek.date, 'YYYY-MM-DD') = to_char(public.user.created_at, 'YYYY-MM-DD') AND 
          public.user.deleted_at IS NULL
        WHERE lastWeek.date IS NOT NULL
        GROUP BY lastWeek.date
        ORDER BY lastWeek.date ASC;
      `,
    );
  }

  findAllDeleted(
    page: number,
    take: number,
    filters: DeletedUserListFiltersDto,
  ): Promise<[User[], number]> {
    return this.userRepository
      .createQueryBuilder('user')
      .take(take)
      .skip((page - 1) * take)
      .withDeleted()
      .orderBy('user.deletedAt', 'DESC')
      .where('user.deletedAt IS NOT NULL')
      .andWhere(
        new Brackets((query) =>
          query
            .where('to_tsvector(user.firstName) @@ plainto_tsquery(:q)')
            .orWhere('to_tsvector(user.lastName) @@ plainto_tsquery(:q)')
            .orWhere('to_tsvector(user.phone) @@ plainto_tsquery(:q)')
            .orWhere("user.firstName ILIKE '%' || :q || '%'")
            .orWhere("user.lastName ILIKE '%' || :q || '%'")
            .orWhere("user.phone ILIKE '%' || :q || '%'"),
        ),
      )
      .andWhere('user.role = ANY(:roles)')
      .andWhere(
        'CASE WHEN (:fromDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.createdAt)) * 1000, 0)::BIGINT >= (:fromDate)::BIGINT ELSE TRUE END',
      )
      .andWhere(
        'CASE WHEN (:toDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.createdAt)) * 1000, 0)::BIGINT <= (:toDate)::BIGINT ELSE TRUE END',
      )
      .andWhere(
        'CASE WHEN (:deletedDate)::BIGINT > 0 THEN COALESCE(EXTRACT(EPOCH FROM date(user.deletedAt)) * 1000, 0)::BIGINT = (:deletedDate)::BIGINT ELSE TRUE END',
      )
      .setParameters({
        q: filters.q,
        roles: filters.roles,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        deletedDate: filters.deletedDate,
      })
      .getManyAndCount();
  }

  async findDeletedOne(id: number): Promise<DeletedUserDto> {
    const [response]: DeletedUserDto[] = await this.userRepository.query(
      `
        SELECT
          user1.id AS id,
          user1.first_name AS "firstName",
          user1.last_name AS "lastName",
          user1.email AS email,
          user1.phone AS phone,
          user1.role AS role,
          user1.created_by AS "createdBy",
          user1.created_at AS "createdAt",
          user1.updated_at AS "updatedAt",
          user1.deleted_at AS "deletedAt",
          json_build_object(
            'id', user2.id,
            'firstName', user2.first_name,
            'lastName', user2.last_name,
            'email', user2.email,
            'phone', user2.phone,
            'role', user2.role,
            'createdBy', user2.created_by,
            'createdAt', user2.created_at,
            'updatedAt', user2.updated_at,
            'deletedAt', user2.deleted_at
          ) AS parent
        FROM public.user AS user1
        LEFT JOIN public.user AS user2 ON user2.id = user1.created_by
        WHERE user1.id = $1 AND user1.deleted_at IS NOT NULL;
      `,
      [id],
    );

    if (!response) throw new NotFoundException('Could not found the user.');
    return response;
  }

  restoreOneWithEntityManager(
    restoreUserId: number,
    currentUserId: number,
    entityManager: EntityManager,
  ): Promise<User> {
    return entityManager
      .createQueryBuilder(User, 'public.user')
      .restore()
      .where('public.user.id = :restoreUserId')
      .andWhere('public.user.deleted_at IS NOT NULL')
      .andWhere('public.user.created_by = :currentUserId')
      .setParameters({ restoreUserId, currentUserId })
      .returning('*')
      .exe({ noEffectError: 'Could not restore the user.' });
  }

  async restoreOne(id: number, user: User): Promise<User> {
    return this.restoreUserTransaction.run({ id, user });
  }
}
