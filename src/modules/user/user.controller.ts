import { 
  Controller, Get, Post, Body, Param, Delete, UseGuards, Request, ConflictException 
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UserService } from './user.service';
import { RoleService } from '../role/role.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RegisterDto } from '../auth/dto/register.dto';
import * as bcrypt from 'bcryptjs';


@ApiTags('用户')
@ApiBearerAuth('JWT')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  /** 🔍 模糊搜索用户（排除自己） */
  @Get('search/:keyword')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: '模糊搜索用户', description: '根据用户名模糊搜索用户，排除当前登录用户' })
  @ApiParam({ name: 'keyword', description: '搜索关键字', example: '张三' })
  @ApiResponse({ status: 200, description: '返回匹配的用户列表' })
  async searchUser(@Param('keyword') keyword: string, @Request() req) {
    return this.userService.search(keyword, req.user.userId);
  }

  /** 管理员创建用户 */
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '管理员创建用户', description: '只有 admin 角色可以创建新用户' })
  @ApiResponse({ status: 201, description: '用户创建成功' })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  async create(@Body() registerDto: RegisterDto) {
    const exist = await this.userService.findByUsername(registerDto.username);
    if (exist) throw new ConflictException('用户名已存在');

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const roleNames = registerDto.roles && registerDto.roles.length > 0 ? registerDto.roles : ['user'];
    const roles = await this.roleService.findByNames(roleNames);

    return this.userService.create({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      roles,
    });
  }

  /** 查询所有用户 */
  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '查询所有用户', description: '返回系统中所有用户及其角色信息' })
  @ApiResponse({ status: 200, description: '用户列表' })
  async findAll() {
    return this.userService.findAll();
  }

  /** 根据 ID 查询用户 */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '根据ID查询用户', description: '返回指定ID的用户信息' })
  @ApiParam({ name: 'id', description: '用户ID', example: 1 })
  @ApiResponse({ status: 200, description: '用户信息' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async findOne(@Param('id') id: number) {
    return this.userService.findById(id);
  }

  /** 删除用户（软删除） */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '删除用户', description: '软删除指定用户（仅标记为删除）' })
  @ApiParam({ name: 'id', description: '用户ID', example: 1 })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async remove(@Param('id') id: number) {
    return this.userService.remove(id);
  }
}
