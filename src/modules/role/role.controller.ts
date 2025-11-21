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
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { DeleteRoleDto } from './dto/delete-role.dto';
import { RolePaginationDto } from './dto/role-pagination.dto';
import { AssignPermissionsDto } from '../permission/dto/assign-permission.dto';

@ApiTags('角色管理')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

 @Get()
@ApiOperation({ summary: '角色列表（分页 + 搜索）' })
@ApiQuery({ name: 'page', required: false, example: 1 })
@ApiQuery({ name: 'pageSize', required: false, example: 10 })
@ApiQuery({ name: 'keyword', required: false, example: 'admin' })
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
  @ApiBody({ type: CreateRoleDto, description: '创建角色信息' })
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  /** 更新角色 */
  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: '更新角色' })
  @ApiParam({ name: 'id', description: '角色ID', example: 1 })
  @ApiBody({ type: UpdateRoleDto, description: '更新角色信息' })
  update(@Param('id') id: number, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }

  /** 删除角色（支持批量） */
  @Delete()
  @Roles('admin')
  @ApiOperation({ summary: '删除角色（支持批量）' })
  @ApiBody({ type: DeleteRoleDto, description: '批量删除角色ID列表' })
  remove(@Body() dto: DeleteRoleDto) {
    // 调用 service 并传 roleIds
    return this.roleService.remove(dto.roleIds);
  }

  /** 给角色分配权限 */
  @Post('permissions/assign')
  @Roles('admin')
  @ApiOperation({ summary: '给角色分配权限' })
  @ApiBody({ type: AssignPermissionsDto, description: '分配权限信息' })
  assignPermissions(@Body() dto: AssignPermissionsDto) {
    return this.roleService.assignPermissionsToRole(dto.roleCode, dto.permissionCodes);
  }

  /** 查看角色权限 */
  @Get('permissions/:roleCode')
  @Roles('admin')
  @ApiOperation({ summary: '查看角色权限' })
  @ApiParam({ name: 'roleCode', description: '角色名称', example: 'admin' })
  getRolePermissions(@Param('roleCode') roleCode: string) {
    return this.roleService.getRolePermissions(roleCode);
  }
}
