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
    roles: user.roles.map((r) => r.roleCode),
  };
  return {
    access_token: this.jwtService.sign(payload),
    sub: user.user_id,
    roles: user.roles.map((r) => r.roleCode),
    fullName: user.fullName,
  };
}

async register(registerDto: RegisterDto) {
  // 禁止注册接口传角色字段（防止前端恶意构造）
  if ('roles' in registerDto) {
    throw new UnauthorizedException('注册时不能指定角色');
  }

  const exist = await this.userService.findByUsername(registerDto.username);
  if (exist) throw new ConflictException('用户名已存在');

  const hashedPassword = await bcrypt.hash(registerDto.password, 10);

  // 强制为普通用户
  const roles = await this.roleService.findByCodes(['user']);
  if (!roles || roles.length === 0) {
    throw new UnauthorizedException('系统未找到默认角色 user');
  }

  const newUser = await this.userService.create({
    username: registerDto.username,
    fullName: registerDto.fullName,
    email: registerDto.email,
    password: hashedPassword,
    is_active: registerDto.is_active ?? true,
    roles,
  });

  const payload = {
    username: newUser.username,
    sub: newUser.user_id,
    roles: newUser.roles.map((r) => r.roleCode),
  };

  return ApiResponse.success(
    {
      access_token: this.jwtService.sign(payload),
      sub: newUser.user_id,
      roles: newUser.roles.map((r) => r.roleCode),
      fullName: newUser.fullName,
    },
    '注册成功',
  );
}


}
