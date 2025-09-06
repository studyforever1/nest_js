import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { ApiResponse } from '../../common/response/response.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userService.findByUsername(username, ['user_id', 'username', 'password', 'role']);
    if (!user) throw new UnauthorizedException('用户名或密码错误');

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('用户名或密码错误');

    const { password, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.user_id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      sub: user.user_id,
      role: user.role,
    };
  }

  async register(registerDto: RegisterDto) {
    const exist = await this.userService.findByUsername(registerDto.username);
    if (exist) throw new ConflictException('用户名已存在');

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const newUser = await this.userService.create({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      role: 'user', // 普通注册只能是 user
    });

    const payload = { username: newUser.username, sub: newUser.user_id, role: newUser.role };
    const token = this.jwtService.sign(payload);

    return ApiResponse.success({ access_token: token, sub: newUser.user_id, role: newUser.role }, '注册成功');
  }
}
