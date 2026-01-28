import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from '../role/entities/role.entity'; // ✅ 导入 Role 实体
import { Department } from '../department/entities/department.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { RoleModule } from '../role/role.module';
import { ImModule } from '../im/im.module'; // ✅ 导入 ImModule

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Department]), // ✅ 注册 User、Role、Department
    RoleModule, // 注入 RoleService
    ImModule
  ],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
