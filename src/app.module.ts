import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule } from '@nestjs/config';
import { CalcModule } from './modules/calc/calc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用 process.env
    }),
    TypeOrmModule.forRoot(databaseConfig),
    UsersModule,
    CalcModule,
  ],
})
export class AppModule {}
