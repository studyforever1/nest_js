import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ConflictException
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { UserService } from './user.service';
import { RoleService } from '../role/role.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { UserPaginationDto } from './dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('用户')
@ApiBearerAuth('JWT')
@Controller('user')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  /** 管理员创建用户 */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '管理员创建用户', description: '只有 admin 角色可以创建新用户' })
  @ApiResponse({ status: 201, description: '用户创建成功' })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  @ApiBody({ type: CreateUserDto })
  async create(@Body() registerDto: CreateUserDto) {
    const exist = await this.userService.findByUsername(registerDto.username);
    if (exist) throw new ConflictException('用户名已存在');

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // 前端传入 roles 期望为 roleCode 列表（例如 ['admin', 'operator']）
    const roleCodes = registerDto.roles && registerDto.roles.length > 0 ? registerDto.roles : ['user'];
    const roles = await this.roleService.findByCodes(roleCodes);

    return this.userService.create({
      username: registerDto.username,
      fullName: registerDto.fullName,
      email: registerDto.email,
      password: hashedPassword,
      is_active: registerDto.is_active ?? true,
      roles,
    });
  }

  /** 查询用户（分页 + 搜索） */
  @Get()
  @Roles('admin')
  @ApiOperation({ summary: '查询用户（分页 + 搜索）' })
  @ApiResponse({ status: 200, description: '用户列表' })
  async findAll(@Query() query: UserPaginationDto) {
    return this.userService.queryUsers({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      keyword: query.keyword,
    });
  }

  /** 根据 ID 查询用户 */
  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: '根据ID查询用户', description: '返回指定ID的用户信息' })
  @ApiParam({ name: 'id', description: '用户ID', example: 1 })
  @ApiResponse({ status: 200, description: '用户信息' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async findOne(@Param('id') id: number) {
    return this.userService.findById(id);
  }

  /** 更新用户信息 */
  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: '更新用户信息', description: '更新指定用户的基础信息及状态' })
  @ApiParam({ name: 'id', description: '用户ID', example: 1 })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: '更新成功' })
  async update(@Param('id') id: number, @Body() dto: UpdateUserDto) {
    // 如果更新用户名，需要检查是否已存在
    if (dto.username) {
      const exist = await this.userService.findByUsername(dto.username);
      if (exist && exist.user_id !== id) throw new ConflictException('用户名已存在');
    }

    // 如果更新密码，需要先加密
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    // 如果更新角色，需要先查询 Role 实体（前端传 roleCode 数组）
    let roles;
    if (dto.roles) {
      roles = await this.roleService.findByCodes(dto.roles);
    }

    return this.userService.update(id, {
      ...dto,
      roles,
    });
  }

  /** 删除用户（软删除） */
  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: '删除用户', description: '软删除指定用户（仅标记为删除）' })
  @ApiParam({ name: 'id', description: '用户ID', example: 1 })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async remove(@Param('id') id: number) {
    return this.userService.remove(id);
  }
}
