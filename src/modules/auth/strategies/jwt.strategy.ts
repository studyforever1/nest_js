import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'your_secret_key123123', // 建议放到 .env
    });
  }

  async validate(payload: any): Promise<User> {
    const user = await this.userService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('用户不存在');
    return user; // 包含 roles 数组
  }
}
