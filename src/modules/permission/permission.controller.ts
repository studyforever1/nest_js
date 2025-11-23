// src/modules/permission/permission.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionPaginationDto } from './dto/permission-pagination.dto';

@ApiTags('权限管理')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  /** 列表 */
  @Get()
  @Roles('admin')
  @ApiOperation({ summary: '权限列表（分页 + 搜索）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  findAll(@Query() query: PermissionPaginationDto) {
    return this.permissionService.findAll(query);
  }

  /** 新增 */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '新增权限' })
  @ApiBody({ type: CreatePermissionDto })
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionService.create(dto);
  }

  /** 更新 */
  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: '更新权限' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: UpdatePermissionDto })
  update(@Param('id') id: number, @Body() dto: UpdatePermissionDto) {
    return this.permissionService.update(id, dto);
  }

  /** 删除（支持批量） */
  @Delete()
  @Roles('admin')
  @ApiOperation({ summary: '删除权限（支持批量）' })
  @ApiBody({ schema: { properties: { ids: { type: 'array', items: { type: 'number' } } } } })
  remove(@Body() body: { ids: number[] }) {
    return this.permissionService.remove(body.ids);
  }
}
