import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class InitialUserStatusDto {
  @IsNumber()
  @ApiProperty()
  id: number;
}
