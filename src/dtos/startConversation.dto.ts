import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class StartConversationDto {
  @IsNumber()
  @ApiProperty()
  id: number;
}
