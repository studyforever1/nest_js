import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { AssignPermissionsDto } from '../permission/dto/assign-permission.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('角色管理')
@ApiBearerAuth('JWT')
@Controller('role')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /** 管理员给角色分配权限 */
  @Post('permissions/assign')
  @Roles('admin')
  @ApiOperation({ summary: '给角色分配权限' })
  async assignPermissions(@Body() dto: AssignPermissionsDto) {
    return this.roleService.assignPermissionsToRole(dto.roleCode, dto.permissionCodes);
  }

  /** 查询某个角色的权限 */
  @Get('permissions/:roleCode')
  @Roles('admin')
  @ApiOperation({ summary: '查询角色权限' })
  async getRolePermissions(@Param('roleCode') roleCode: string) {
    return this.roleService.getRolePermissions(roleCode);
  }
}
