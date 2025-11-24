// src/modules/role/role.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { DeleteRoleDto } from './dto/delete-role.dto';
import { RolePaginationDto } from './dto/role-pagination.dto';

@ApiTags('角色管理')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /** 角色列表 */
  @Get()
  @ApiOperation({ summary: '角色列表（分页 + 搜索）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  findAll(@Query() query: RolePaginationDto) {
    return this.roleService.findAll({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      keyword: query.keyword,
    });
  }

  /** 新增角色 */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '新增角色' })
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  /** 更新角色 */
  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: '更新角色' })
  update(@Param('id') id: number, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }

  /** 删除角色（批量） */
  @Delete()
  @Roles('admin')
  @ApiOperation({ summary: '删除角色（支持批量）' })
  remove(@Body() dto: DeleteRoleDto) {
    return this.roleService.remove(dto.roleIds);
  }

  /** 给角色分配菜单（含按钮） */
  @Post('menus/assign')
  @Roles('admin')
  @ApiOperation({ summary: '给角色分配菜单（含按钮权限）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        roleCode: { type: 'string' },
        menuIds: { type: 'array', items: { type: 'number' } },
      },
      example: {
        roleCode: 'admin',
        menuIds: [1, 2, 3, 10],
      },
    },
  })
  assignMenus(@Body() dto: { roleCode: string; menuIds: number[] }) {
    return this.roleService.assignMenusToRole(dto.roleCode, dto.menuIds);
  }

  /** 获取角色的菜单权限 */
  @Get('menus/:roleCode')
  @Roles('admin')
  @ApiOperation({ summary: '查看角色菜单权限（含按钮）' })
  getRoleMenus(@Param('roleCode') roleCode: string) {
    return this.roleService.getRoleMenus(roleCode);
  }
}
