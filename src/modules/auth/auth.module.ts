import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { RoleModule } from '../role/role.module';
import { appConfig } from '../../config/app.config';
import { ImModule } from '../im/im.module';


@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UserModule,
    RoleModule,
    ImModule,
    JwtModule.register({
      secret: appConfig.jwt.secret, // 建议放到 .env
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService,JwtModule], // 给其他模块用
})
export class AuthModule {}
