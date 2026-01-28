import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity';
import { User } from '../user/entities/user.entity';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';

/**
 * 部门管理模块
 * 提供部门的增删改查、用户关联管理等功能
 */
@Module({
  imports: [TypeOrmModule.forFeature([Department, User])],
  providers: [DepartmentService],
  controllers: [DepartmentController],
  exports: [DepartmentService], // 导出服务供其他模块使用
})
export class DepartmentModule {}

