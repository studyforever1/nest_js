import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SjEconConfigService } from '../services/sj-econ-config.service';
import { ApiResponse } from '../../../common/response/response.dto';
import { ApiOkResponseData, ApiErrorResponse } from '../../../common/response/response.decorator';
import { User } from '../../user/entities/user.entity';

@ApiTags('烧结原料经济性评价参数设置')
@Controller('api/v1/sj-econ-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class SjEconConfigController {
  constructor(private readonly service: SjEconConfigService) {}

  /**
   * 1. 获取最新参数组
   * GET /sj-econ-config
   */
  @Get()
  @ApiOperation({ summary: '获取最新参数组' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:read')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async getLatest(@CurrentUser() user: User) {
    try {
      const result = await this.service.getLatestConfig(user);
      return ApiResponse.success({ result }, '获取参数成功');
    } catch (error) {
      return ApiResponse.error(error.message || '参数错误:名称不能为空', 4001);
    }
  }

  /**
   * 2. 修改 singleBurnSet 原料
   * PATCH /sj-econ-config/single-burn/raw-materials/:materialKey
   */
  @Patch('single-burn/raw-materials/:materialKey')
  @ApiOperation({ summary: '修改 singleBurnSet 原料' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:update')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async updateSingleBurnRawMaterial(
    @CurrentUser() user: User,
    @Param('materialKey') materialKey: string,
    @Body() data: Record<string, any>,
  ) {
    try {
      const result = await this.service.updateSingleBurnRawMaterial(user, materialKey, data);
      return ApiResponse.success({ result }, '修改单烧综合评价法原料成功');
    } catch (error) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  /**
   * 3. 修改 singleBurnSet 其他参数
   * PATCH /sj-econ-config/single-burn/other-settings
   */
  @Patch('single-burn/other-settings')
  @ApiOperation({ summary: '修改 singleBurnSet 其他参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:update')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async updateSingleBurnOtherSettings(@CurrentUser() user: User, @Body() data: Record<string, any>) {
    try {
      const result = await this.service.updateSingleBurnOtherSettings(user, data);
      return ApiResponse.success({ result }, '修改单烧综合评价法其他参数成功');
    } catch (error) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  /**
   * 4. 修改 ironCostSet 原料
   * PATCH /sj-econ-config/iron-cost/raw-materials/:materialKey
   */
  @Patch('iron-cost/raw-materials/:materialKey')
  @ApiOperation({ summary: '修改 ironCostSet 原料' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:update')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async updateIronCostRawMaterial(
    @CurrentUser() user: User,
    @Param('materialKey') materialKey: string,
    @Body() data: Record<string, any>,
  ) {
    try {
      const result = await this.service.updateIronCostRawMaterial(user, materialKey, data);
      return ApiResponse.success({ result }, '修改铁水成本评价法原料成功');
    } catch (error) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  /**
   * 5. 修改 ironCostSet 其他参数
   * PATCH /sj-econ-config/iron-cost/other-settings
   */
  @Patch('iron-cost/other-settings')
  @ApiOperation({ summary: '修改 ironCostSet 其他参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:update')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async updateIronCostOtherSettings(@CurrentUser() user: User, @Body() data: Record<string, any>) {
    try {
      const result = await this.service.updateIronCostOtherSettings(user, data);
      return ApiResponse.success({ result }, '修改铁水成本评价法其他参数成功');
    } catch (error) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  /**
   * 6. 修改 ironCostSet 焦炭和煤
   * PATCH /sj-econ-config/iron-cost/coke-coal
   */
  @Patch('iron-cost/coke-coal')
  @ApiOperation({ summary: '修改 ironCostSet 焦炭和煤' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:update')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async updateIronCostCokeCoal(@CurrentUser() user: User, @Body() data: { 喷吹煤?: Record<string, any>; 焦炭?: Record<string, any> }) {
    try {
      const result = await this.service.updateIronCostCokeCoal(user, data);
      return ApiResponse.success({ result }, '修改焦炭和煤参数成功');
    } catch (error) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  // 保留原有方法以兼容
  @Post()
  @ApiOperation({ summary: '创建烧结原料经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:create')
  async create(@Body() data: any) {
    return await this.service.create(data);
  }

  @Get('list')
  @ApiOperation({ summary: '获取烧结原料经济性评价参数列表' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:read')
  async findAll() {
    return await this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个烧结原料经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:read')
  async findOne(@Param('id') id: string) {
    return await this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新烧结原料经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:update')
  async update(@Param('id') id: string, @Body() data: any) {
    return await this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除烧结原料经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-config:delete')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { message: '删除成功' };
  }
}
