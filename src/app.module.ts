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
import { SjCandidateModule } from './modules/sj-candidate/sj-candidate.module';
import { SharedDataModule } from './modules/shared-data/shared-data.module';


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
    SjCandidateModule,
    SharedDataModule,
  ],
})
export class AppModule {}
