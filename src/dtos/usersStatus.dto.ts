import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UsersStatusDto {
  @IsNumber({}, { each: true })
  @ApiProperty()
  ids: number[];
}
