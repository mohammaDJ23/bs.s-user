import { UserRoles } from 'src/types';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UserListFiltersDto {
  @IsString()
  @IsOptional()
  @ApiProperty()
  q: string;

  @IsEnum(UserRoles, { each: true })
  @IsOptional()
  @ApiProperty({ enum: [UserRoles] })
  roles: UserRoles[];

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @ApiProperty()
  fromDate: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @ApiProperty()
  toDate: number;
}
