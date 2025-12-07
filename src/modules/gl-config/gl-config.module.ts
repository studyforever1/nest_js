import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlConfigService } from './gl-config.service';
import { GlConfigController } from './gl-config.controller';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigGroup,
      BizModule,
      User,
      GlMaterialInfo, // <-- 注册
      GlFuelInfo,     // <-- 注册
    ]),
    UserModule,
  ],
  providers: [GlConfigService],
  controllers: [GlConfigController],
  exports: [GlConfigService],
})
export class GlConfigModule {}
