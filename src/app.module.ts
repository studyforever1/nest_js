import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { CalcModule } from './modules/sj-calc/sj-calc.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { PermissionModule } from './modules/permission/permission.module';
import { SjconfigModule } from './modules/sj-config/sj-config.module';
import { SjRawMaterialModule } from './modules/sj-raw-material/sj-raw-material.module';
import { ChatModule } from './modules/chat/chat.module';
import { HistoryModule } from './modules/history/history.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用 process.env
    }),
    TypeOrmModule.forRoot(databaseConfig),
    CalcModule,
    AuthModule,
    UserModule,
    RoleModule,
    PermissionModule,
    SjconfigModule,
    SjRawMaterialModule,
    ChatModule,
    HistoryModule,
  ],
})
export class AppModule {}
