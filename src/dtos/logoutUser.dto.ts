import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class LogoutUserDto {
  @IsNumber()
  @ApiProperty()
  id: number;
}
