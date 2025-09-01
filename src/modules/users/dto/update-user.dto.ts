import { IsEmail, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '用户名', example: 'john_doe' })
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ description: '密码', example: '123456' })
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ description: '邮箱', example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: '是否激活', example: true })
  @IsOptional()
  is_active?: boolean;
}
