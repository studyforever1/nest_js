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
import { TqythCalcModule } from './modules/tqyth-calc/tqyth-calc.module';
import { LlythCalcModule } from './modules/llyth-calc/llyth-calc.module';
import { PriceProfitCalcModule } from './modules/price-profit-calc/price-profit-calc.module';
import { SjEconCalcModule } from './modules/sj-econ-calc/sj-econ-calc.module';
import { CokeEconInfoModule } from './modules/coke-econ-info/coke-econ-info.module';
import { CokeEconConfigModule } from './modules/coke-econ-config/coke-econ-config.module';
import { CokeEconCalcModule } from './modules/coke-econ-calc/coke-econ-calc.module';
import { CoalEconInfoModule } from './modules/coal-econ-info/coal-econ-info.module';
import { CoalEconConfigModule } from './modules/coal-econ-config/coal-econ-config.module';
import { PelletEconInfoModule } from './modules/pellet-econ-info/pellet-econ-info.module';
import { LumpEconInfoModule } from './modules/lump-econ-info/lump-econ-info.module';
import { FinesHtBasePropModule } from './modules/fines-ht-base-prop/fines-ht-base-prop.module';
import { LumpMetallurgyPropModule } from './modules/lump-metallurgy-prop/lump-metallurgy-prop.module';
import { MineTypIndModule } from './modules/mine-typ-ind/mine-typ-ind.module';
import { SjFinesChemTypModule } from './modules/sj-fines-chem-typ/sj-fines-chem-typ.module';
import { LumpEconConfigModule } from './modules/lump-econ-config/lump-econ-config.module';
import { LumpEconCalcModule } from './modules/lump-econ-calc/lump-econ-calc.module';
import { PelletEconConfigModule } from './modules/pellet-econ-config/pellet-econ-config.module';
import { PelletEconCalcModule } from './modules/pellet-econ-calc/pellet-econ-calc.module';
import { CoalEconCalcModule } from './modules/coal-econ-calc/coal-econ-calc.module';
import { MixCoalConfigModule } from './modules/mix-coal-config/mix-coal-config.module';
import { MixCoalCalcModule } from './modules/mix-coal-calc/mix-coal-calc.module';
import { SystemLatestSchemeModule } from './modules/system-latest-scheme/system-latest-scheme.module';
import { NotificationModule } from './modules/notification/notification.module';



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
    SjEconInfoModule,
    SjEconConfigModule,
    SjEconCalcModule,
    CokeEconInfoModule,
    CokeEconConfigModule,
    CokeEconCalcModule,
    CoalEconInfoModule,
    CoalEconConfigModule,
    PelletEconInfoModule,
    LumpEconInfoModule,
    FinesHtBasePropModule,
    LumpMetallurgyPropModule,
    MineTypIndModule,
    SjFinesChemTypModule,
    LumpEconConfigModule,
    LumpEconCalcModule,
    PelletEconConfigModule,
    PelletEconCalcModule,
    CoalEconCalcModule,
    MixCoalConfigModule,
    MixCoalCalcModule,
    SystemLatestSchemeModule,
    NotificationModule
  ],
})
export class AppModule {}
