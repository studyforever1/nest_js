import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { ApiResponse } from '../../common/response/response.dto';
import * as bcrypt from 'bcryptjs';
import { RoleService } from '../role/role.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly roleService: RoleService,
  ) {}

  /** 校验用户登录 */
  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userService.findByUsername(username, {
      select: ['user_id', 'username', 'password', 'is_active', 'fullName'],
      relations: ['roles'], // ✅ 多角色
    });

    if (!user) throw new UnauthorizedException('用户名或密码错误');
    if (!user.is_active) throw new UnauthorizedException('用户已被禁用');

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('用户名或密码错误');

    const { password, ...result } = user;
    return result;
  }

  /** 登录 */
  async login(user: any) {
    const payload = {
      username: user.username,
      sub: user.user_id,
      roles: user.roles.map((r) => r.name), // ✅ 多角色
    };
    return {
      access_token: this.jwtService.sign(payload),
      sub: user.user_id,
      roles: user.roles.map((r) => r.name),
      fullName: user.fullName,
    };
  }

  /** 注册用户 */
  async register(registerDto: RegisterDto) {
    const exist = await this.userService.findByUsername(registerDto.username);
    if (exist) throw new ConflictException('用户名已存在');

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // 默认普通注册用户分配 'user' 角色
    const roles = await this.roleService.findByNames(['user']);

    const newUser = await this.userService.create({
      username: registerDto.username,
      fullName: registerDto.fullName, // 新增字段
      email: registerDto.email,
      password: hashedPassword,
      is_active: registerDto.is_active ?? true, // 默认启用
      roles,
    });

    const payload = {
      username: newUser.username,
      sub: newUser.user_id,
      roles: newUser.roles.map((r) => r.name),
    };
    const token = this.jwtService.sign(payload);

    return ApiResponse.success(
      {
        access_token: token,
        sub: newUser.user_id,
        roles: newUser.roles.map((r) => r.name),
        fullName: newUser.fullName,
      },
      '注册成功',
    );
  }
}
