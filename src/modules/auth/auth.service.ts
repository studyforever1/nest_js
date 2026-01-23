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
import { ImService } from '../im/im.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly roleService: RoleService,
    private readonly imService: ImService,
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

  // 1️⃣ 检查用户名是否已存在
  const exist = await this.userService.findByUsername(registerDto.username);
  if (exist) throw new ConflictException('用户名已存在');

  // 2️⃣ 密码加密
  const hashedPassword = await bcrypt.hash(registerDto.password, 10);

  // 3️⃣ 默认分配 user 角色
  const roles = await this.roleService.findByCodes(['user']);
  if (!roles || roles.length === 0) {
    throw new UnauthorizedException('系统未找到默认角色 user');
  }

  // 4️⃣ 创建系统用户
  const newUser = await this.userService.create({
    username: registerDto.username,
    fullName: registerDto.fullName,
    email: registerDto.email,
    password: hashedPassword,
    is_active: registerDto.is_active ?? true,
    roles,
  });

  // 5️⃣ 创建 IM 用户
  try {
    await this.imService.createImUser(newUser);
  } catch (err) {
    console.error('IM 用户创建失败:', err);
    // 可以选择：回滚用户创建或只记录日志
    throw new ConflictException('注册失败：IM 用户创建失败，请联系管理员');
  }

  // 6️⃣ 生成 JWT
  const payload = {
    username: newUser.username,
    sub: newUser.user_id,
    roles: newUser.roles.map((r) => r.roleCode),
  };

  // 7️⃣ 返回注册成功 + JWT + IM 登录信息（可选）
  return ApiResponse.success(
    {
      access_token: this.jwtService.sign(payload),
      sub: newUser.user_id,
      roles: newUser.roles.map((r) => r.roleCode),
      fullName: newUser.fullName,
      imLoginInfo: this.imService.getLoginInfo(newUser.user_id), // 🔹 可选返回 IM 登录信息
    },
    '注册成功',
  );
}


}
