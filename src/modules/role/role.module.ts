// role.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { Role } from './entities/role.entity';
import { Menu } from '../menu/entity/menu.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Menu]), // ✅ 确保 Menu 也在这里
  ],
  providers: [RoleService],
  controllers: [RoleController],
  exports: [RoleService],
})
export class RoleModule {}
