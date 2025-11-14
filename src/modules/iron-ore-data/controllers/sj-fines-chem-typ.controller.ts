import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { SjFinesChemTypService } from '../services/sj-fines-chem-typ.service';
import { CreateSjFinesChemTypDto, UpdateSjFinesChemTypDto, QuerySjFinesChemTypDto } from '../dto/sj-fines-chem-typ.dto';
import { SjFinesChemTyp } from '../entities/sj-fines-chem-typ.entity';
import { PaginatedResult } from '../../../common/dto/pagination.dto'

/**
 * 烧结矿粉化学成分典型值控制器
 * 
 * 提供烧结矿粉化学成分数据的RESTful API接口
 * 功能包括：
 * - CRUD操作（创建、查询、更新、删除）
 * - 分页查询和条件过滤
 * - Excel文件导入导出
 * - 数据统计分析
 * - JWT认证和权限控制
 * 
 * @example
 * ```typescript
 * // 获取所有记录（需要认证和权限）
 * GET /api/v1/sj-fines-chem-typ?page=1&limit=10
 * 
 * // 创建新记录
 * POST /api/v1/sj-fines-chem-typ
 * {
 *   "categoryCode": "CAT001",
 *   "materialName": "烧结矿粉001",
 *   "tfe": 62.5
 * }
 * ```
 */
@ApiTags('烧结矿粉化学成分典型值')
@Controller('api/v1/sj-fines-chem-typ')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class SjFinesChemTypController {
  constructor(private readonly sjFinesChemTypService: SjFinesChemTypService) {}

  /**
   * 创建新的烧结矿粉化学成分记录
   * 
   * 创建一条新的烧结矿粉化学成分典型值记录
   * 需要JWT认证和创建权限
   * 
   * @param createDto 创建数据传输对象
   * @returns 创建的记录
   * 
   * @example
   * ```typescript
   * POST /api/v1/sj-fines-chem-typ
   * Authorization: Bearer <JWT_TOKEN>
   * {
   *   "categoryCode": "CAT001",
   *   "materialName": "烧结矿粉001",
   *   "tfe": 62.5,
   *   "cao": 8.5,
   *   "price": 500.0
   * }
   * ```
   */
  @Post()
  @ApiOperation({ summary: '创建烧结矿粉化学成分典型值' })
  @ApiResponse({ status: 201, description: '创建成功', type: SjFinesChemTyp })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-fines-chem-typ:create')
  async create(@Body() createDto: CreateSjFinesChemTypDto): Promise<SjFinesChemTyp> {
    return await this.sjFinesChemTypService.create(createDto);
  }

  /**
   * 获取烧结矿粉化学成分记录列表
   * 
   * 支持分页查询和多种过滤条件
   * 需要JWT认证和读取权限
   * 
   * @param queryDto 查询参数，包含分页和过滤条件
   * @returns 分页查询结果
   * 
   * @example
   * ```typescript
   * GET /api/v1/sj-fines-chem-typ?page=1&limit=10&categoryCode=CAT001&tfeMin=60
   * Authorization: Bearer <JWT_TOKEN>
   * ```
   */
  @Get()
  @ApiOperation({ summary: '获取烧结矿粉化学成分典型值列表' })
  @ApiResponse({ status: 200, description: '查询成功', type: PaginatedResult<SjFinesChemTyp> })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-fines-chem-typ:read')
  async findAll(@Query() queryDto: QuerySjFinesChemTypDto): Promise<PaginatedResult<SjFinesChemTyp>> {
    return await this.sjFinesChemTypService.findAll(queryDto);
  }

  /**
   * 根据ID获取单个记录
   * 
   * 通过记录ID获取特定的烧结矿粉化学成分记录
   * 需要JWT认证和读取权限
   * 
   * @param id 记录的唯一标识符（UUID格式）
   * @returns 找到的记录
   * 
   * @example
   * ```typescript
   * GET /api/v1/sj-fines-chem-typ/uuid-string
   * Authorization: Bearer <JWT_TOKEN>
   * ```
   */
  @Get(':id')
  @ApiOperation({ summary: '获取单个烧结矿粉化学成分典型值' })
  @ApiResponse({ status: 200, description: '查询成功', type: SjFinesChemTyp })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-fines-chem-typ:read')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SjFinesChemTyp> {
    return await this.sjFinesChemTypService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新烧结矿粉化学成分典型值' })
  @ApiResponse({ status: 200, description: '更新成功', type: SjFinesChemTyp })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-fines-chem-typ:update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSjFinesChemTypDto
  ): Promise<SjFinesChemTyp> {
    return await this.sjFinesChemTypService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除烧结矿粉化学成分典型值' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-fines-chem-typ:delete')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.sjFinesChemTypService.remove(id);
    return { message: '删除成功' };
  }

  /**
   * 导入Excel数据
   * 
   * 上传Excel文件并批量导入烧结矿粉化学成分数据
   * 支持多种列名格式，自动处理数据转换
   * 需要JWT认证和导入权限
   * 
   * @param file 上传的Excel文件
   * @returns 导入结果，包含成功数量和错误信息
   * 
   * @example
   * ```typescript
   * POST /api/v1/sj-fines-chem-typ/import
   * Authorization: Bearer <JWT_TOKEN>
   * Content-Type: multipart/form-data
   * 
   * FormData:
   * - file: <Excel文件>
   * ```
   */
  @Post('import')
  @ApiOperation({ summary: '导入烧结矿粉化学成分典型值数据' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: '导入成功' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-fines-chem-typ:import')
  @UseInterceptors(FileInterceptor('file'))
  async importData(@UploadedFile() file: Express.Multer.File): Promise<{
    message: string;
    data: { importedCount: number; totalRows: number; errors: string[] };
  }> {
    const result = await this.sjFinesChemTypService.importFromExcel(file);
    return {
      message: `导入完成，成功导入${result.importedCount}条记录`,
      data: result
    };
  }

  /**
   * 导出Excel数据
   * 
   * 将所有烧结矿粉化学成分数据导出为Excel文件
   * 包含完整的化学成分信息和价格数据
   * 需要JWT认证和导出权限
   * 
   * @returns 导出结果，包含文件路径
   * 
   * @example
   * ```typescript
   * GET /api/v1/sj-fines-chem-typ/export/excel
   * Authorization: Bearer <JWT_TOKEN>
   * ```
   */
  @Get('export/excel')
  @ApiOperation({ summary: '导出烧结矿粉化学成分典型值数据' })
  @ApiResponse({ status: 200, description: '导出成功' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-fines-chem-typ:export')
  async exportData(): Promise<{ message: string; filePath: string }> {
    const filePath = await this.sjFinesChemTypService.exportToExcel();
    return {
      message: '导出成功',
      filePath
    };
  }

  /**
   * 获取统计信息
   * 
   * 计算烧结矿粉化学成分的统计信息
   * 包括各化学成分的最小值、最大值、平均值等
   * 需要JWT认证和统计权限
   * 
   * @returns 统计结果，包含各化学成分和价格的统计信息
   * 
   * @example
   * ```typescript
   * GET /api/v1/sj-fines-chem-typ/statistics/summary
   * Authorization: Bearer <JWT_TOKEN>
   * ```
   */
  @Get('statistics/summary')
  @ApiOperation({ summary: '获取烧结矿粉化学成分典型值统计信息' })
  @ApiResponse({ status: 200, description: '统计信息获取成功' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-fines-chem-typ:statistics')
  async getStatistics(): Promise<any> {
    return await this.sjFinesChemTypService.getStatistics();
  }
}
