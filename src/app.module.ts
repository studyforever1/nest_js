import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { CalcModule } from './modules/sj-calc/sj-calc.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { SjconfigModule } from './modules/sj-config/sj-config.module';
import { SjRawMaterialModule } from './modules/sj-raw-material/sj-raw-material.module';
import { ChatModule } from './modules/chat/chat.module';
import { HistoryModule } from './modules/history/history.module';
import { SjCandidateModule } from './modules/sj-candidate/sj-candidate.module';
import { SharedDataModule } from './modules/shared-data/shared-data.module';
import { IronOreDataModule } from './modules/iron-ore-data/iron-ore-data.module';
import { MenuModule } from './modules/menu/menu.module';
import { GlMaterialInfoModule } from './modules/gl-material-info/gl-material-info.module';
import { GlFuelInfoModule } from './modules/gl-fuel-info/gl-fuel-info.module';
import { GlCalcModule } from './modules/gl-calc/gl-calc.module';
import { GlConfigModule } from './modules/gl-config/gl-config.module';
import { SjEconInfoModule } from './modules/sj-econ-info/sj-econ-info.module';
import { SjEconConfigModule } from './modules/sj-econ-config/sj-econ-config.module';
// import { SjEconCalcModule } from './modules/sj-econ-calc/sj-econ-calc.module';
import { TqythCalcModule } from './modules/tqyth-calc/tqyth-calc.module';
import { LlythCalcModule } from './modules/llyth-calc/llyth-calc.module';
import { PriceProfitCalcModule } from './modules/price-profit-calc/price-profit-calc.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 全局可用 process.env
    }),
    TypeOrmModule.forRoot(databaseConfig),
    MenuModule,
    CalcModule,
    AuthModule,
    UserModule,
    RoleModule,
    SjconfigModule,
    SjRawMaterialModule,
    ChatModule,
    HistoryModule,
    SjCandidateModule,
    SharedDataModule,
    GlMaterialInfoModule,
    GlFuelInfoModule,
    GlConfigModule,
    GlCalcModule,
    TqythCalcModule,
    LlythCalcModule,
    PriceProfitCalcModule,
    // SjEconInfoModule,
    // SjEconConfigModule,
    // SjEconCalcModule
  ],
})
export class AppModule {}
