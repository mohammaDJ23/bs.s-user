import { UserRoles } from 'src/types';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UserListFiltersDto {
  @IsString()
  @IsOptional()
  @ApiProperty()
  q: string = '';

  @IsEnum(UserRoles, { each: true })
  @IsOptional()
  @ApiProperty({ enum: [UserRoles] })
  roles: UserRoles[] = [UserRoles.OWNER, UserRoles.ADMIN, UserRoles.USER];

  @Type(() => Number)
  @IsNumber({}, { each: true })
  @IsOptional()
  @ApiProperty()
  ids: number[] = [];

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @ApiProperty()
  fromDate: number | null = null;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @ApiProperty()
  toDate: number | null = null;
}
