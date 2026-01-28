import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentPaginationDto } from './dto/department-pagination.dto';
import { DeleteDepartmentDto } from './dto/delete-department.dto';

/**
 * 部门管理控制器
 * 提供部门的增删改查、用户关联管理等 RESTful API
 * 所有接口都需要 admin 角色权限
 */
@ApiTags('部门')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  /* ========== 部门基础 CRUD ========== */

  /**
   * 创建部门
   * 需要 admin 角色权限
   */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '创建部门' })
  @ApiBody({ type: CreateDepartmentDto })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentService.create(dto);
  }

  /**
   * 分页查询部门列表
   * 支持按部门名称关键字模糊搜索
   * 需要 admin 角色权限
   */
  @Get()
  @Roles('admin')
  @ApiOperation({ summary: '分页查询部门列表' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  findAll(@Query() query: DepartmentPaginationDto) {
    return this.departmentService.findAll({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      keyword: query.keyword,
    });
  }

  /**
   * 根据ID查询单个部门详情
   * 需要 admin 角色权限
   */
  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: '根据 ID 查询部门' })
  @ApiParam({ name: 'id', description: '部门ID', example: 1 })
  findOne(@Param('id') id: number) {
    return this.departmentService.findOne(id);
  }

  /**
   * 更新部门信息
   * 需要 admin 角色权限
   */
  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: '更新部门信息' })
  @ApiParam({ name: 'id', description: '部门ID', example: 1 })
  update(@Param('id') id: number, @Body() dto: UpdateDepartmentDto) {
    return this.departmentService.update(id, dto);
  }

  /**
   * 删除部门（硬删除）
   * 注意：删除部门不会自动移除用户的部门关联，用户 department 字段会变为 null
   * 需要 admin 角色权限
   */
@Delete()
@Roles('admin')
@ApiOperation({ summary: '删除部门（支持批量）' })
@ApiBody({ type: DeleteDepartmentDto })
removeBatch(@Body() dto: DeleteDepartmentDto) {
  return this.departmentService.removeBatch(dto.ids);
}


  /* ========== 用户与部门关联 ========== */

  /**
   * 将用户添加到指定部门
   * 如果用户已有部门，此操作会覆盖原有部门
   * 需要 admin 角色权限
   */
  @Post(':id/users/:userId')
  @Roles('admin')
  @ApiOperation({ summary: '将用户添加到部门' })
  addUserToDepartment(
    @Param('id') deptId: number,
    @Param('userId') userId: number,
  ) {
    return this.departmentService.addUserToDepartment(deptId, userId);
  }

  /**
   * 将用户从部门中移除
   * 需要 admin 角色权限
   */
  @Delete(':id/users/:userId')
  @Roles('admin')
  @ApiOperation({ summary: '从部门中移除用户' })
  removeUserFromDepartment(
    @Param('id') deptId: number,
    @Param('userId') userId: number,
  ) {
    return this.departmentService.removeUserFromDepartment(deptId, userId);
  }

  /**
   * 分页查询指定部门下的所有用户
   * 需要 admin 角色权限
   */
  @Get(':id/users')
  @Roles('admin')
  @ApiOperation({ summary: '分页查询部门下的用户列表' })
  @ApiParam({ name: 'id', description: '部门ID', example: 1 })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  getUsersByDepartment(
    @Param('id') deptId: number,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 10;
    return this.departmentService.getUsersByDepartment(deptId, p, ps);
  }
}

