import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'test_user' })
  @IsString()  
  username: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  password: string;

  @ApiProperty({ example: 'test@example.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'user', required: false, description: 'user 或 admin' })
  @IsString()
  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: 'user' | 'admin';
}
