import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { ConfigModule } from '@nestjs/config';
import { CalcModule } from './calc/calc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用 process.env
    }),
    TypeOrmModule.forRoot(databaseConfig),
    UsersModule,
    AuthModule,
    TasksModule,
    CalcModule,
  ],
})
export class AppModule {}
