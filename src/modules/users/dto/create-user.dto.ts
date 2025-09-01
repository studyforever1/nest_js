import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: '用户名', example: 'john_doe' })
  @IsNotEmpty()
  username: string;

  @ApiPropertyOptional({ description: '密码', example: '123456' })
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ description: '邮箱', example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
