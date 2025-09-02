// src/users/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'admin', description: '用户名' })
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: '123456', description: '密码', required: false })
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiProperty({ example: 'test@test.com', description: '邮箱', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;
}
