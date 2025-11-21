import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery,ApiBearerAuth } from '@nestjs/swagger';
import { ApiBody } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';


@ApiTags('系统菜单')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('routes')
@ApiOperation({ summary: '获取路由（前端侧边栏菜单）' })
getRoutes() {
  return this.menuService.getRoutes();
}

  @Post()
  @ApiOperation({ summary: '新增菜单' })
  create(@Body() dto: CreateMenuDto) {
    return this.menuService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取菜单列表（支持分页 & 搜索 & 树形结构）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'tree', required: false, description: '是否返回树结构(true/false)' })
  findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('name') name?: string,
    @Query('tree') tree: 'true' | '0' = '0',
  ) {
    return this.menuService.findAll({ page, pageSize, name, tree });
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单个菜单' })
  findOne(@Param('id') id: number) {
    return this.menuService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新菜单' })
  update(@Param('id') id: number, @Body() dto: UpdateMenuDto) {
    return this.menuService.update(id, dto);
  }

  @Delete()
@ApiOperation({ summary: '删除菜单（支持单个或多个）' })
@ApiBody({ 
  description: '要删除的菜单ID数组', 
  schema: { 
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'number' } },
    },
    example: { ids: [1, 2, 3] }
  } 
})
remove(@Body('ids') ids: number[]) {
  return this.menuService.remove(ids);
}
}
