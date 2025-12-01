import { Module } from '@nestjs/common';
import { GlConfigService } from './gl-config.service';
import { GlConfigController } from './gl-config.controller';

@Module({
  providers: [GlConfigService],
  controllers: [GlConfigController]
})
export class GlConfigModule {}
