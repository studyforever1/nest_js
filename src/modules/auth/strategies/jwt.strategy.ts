import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'your_secret_key123123', // 建议放到 .env
    });
  }

  async validate(payload: any) {
    console.log('JWT payload:', payload); 
    return { userId: payload.sub, username: payload.username, role: payload.role };
  }
}
