// im/im.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ImService } from './im.service';
import { ImController } from './im.controller';
import { ImWebhookController } from './im.webhook.controller';

@Module({
  imports: [
    HttpModule, // ✅ 一定要引
  ],
  providers: [ImService],
  controllers: [ImController, ImWebhookController],
  exports: [ImService],
})
export class ImModule {}
