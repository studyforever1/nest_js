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

  @ApiProperty({
    example: ['user'],
    required: false,
    description: '角色数组，例如 [user] 或 [admin]',
  })
  @IsString({ each: true })
  @IsOptional()
  @IsIn(['user', 'admin', 'sj_user', 'lt_user'], { each: true })
  roles?: ('user' | 'admin' | 'sj_user' | 'lt_user')[];
}
