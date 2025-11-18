import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin'})
  @IsString()
  @Transform(({ value }) => String(value))
  username: string;

  @ApiProperty({ example: 'admin123'})
  @IsString()
  @Transform(({ value }) => String(value))
  password: string;
}
