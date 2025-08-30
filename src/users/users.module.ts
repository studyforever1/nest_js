import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // ✅ 关键
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService], // 如果其他模块要用 UsersService
})
export class UsersModule {}
