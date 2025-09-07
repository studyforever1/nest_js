import { Controller, Get, Post, Body, Param, Delete, UseGuards, ConflictException } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RegisterDto } from '../auth/dto/register.dto';
import * as bcrypt from 'bcrypt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleService } from '../role/role.service';

@ApiTags('用户')
@ApiBearerAuth('JWT')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  /** 管理员创建用户 */
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async create(@Body() registerDto: RegisterDto) {
    // 1️⃣ 检查用户名是否存在
    const exist = await this.userService.findByUsername(registerDto.username);
    if (exist) throw new ConflictException('用户名已存在');

    // 2️⃣ 密码加密
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // 3️⃣ 如果没传 roles，默认分配 ['user']
    const roleNames = registerDto.roles && registerDto.roles.length > 0
      ? registerDto.roles
      : ['user'];

    // 4️⃣ 查询 Role 实体数组
    const roles = await this.roleService.findByNames(roleNames);

    // 5️⃣ 创建用户
    return this.userService.create({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      roles, // ✅ Role[] 实体数组
    });
  }

  /** 查询所有用户 */
  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async findAll() {
    // 确保返回的用户对象包含 roles 数组
    return this.userService.findAll();
  }

  /** 根据 ID 查询用户 */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async findOne(@Param('id') id: number) {
    return this.userService.findById(id);
  }

  /** 删除用户（软删除） */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: number) {
    return this.userService.remove(id);
  }
}
