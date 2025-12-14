// src/modules/history/history.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { HistoryService } from './history.service';
import { DeleteHistoryDto } from './dto/delete-history.dto';
import { ListHistoryDto } from './dto/list-history.dto';
import { SaveHistoryDto } from './dto/save-history.dto';
import { Task } from '../../database/entities/task.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ImportGlMaterialDto } from './dto/import-gl-material.dto';

@ApiTags('历史记录管理')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('history')
export class HistoryController {
  constructor(
    private readonly historyService: HistoryService,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

   /** 查询历史记录（分页 + 当天 + 模块类型） */
  @Get('list')
  @ApiOperation({ summary: '获取用户历史记录（分页、当天、模块筛选）' })
  async list(
    @CurrentUser() user: User,
    @Query() query: ListHistoryDto
  ) {
    return this.historyService.list(user, query);
  }

  /** 删除历史记录 */
  @Post('delete')
  @ApiOperation({ summary: '删除用户历史记录，支持单个或批量' })
  async delete(@CurrentUser() user: User, @Body() body: DeleteHistoryDto) {
    return this.historyService.delete(user, body.ids);
  }

  /** 保存用户选择的方案到历史记录 */
  // src/modules/history/history.controller.ts
@Post('save')
@ApiOperation({ summary: '批量保存用户选择的方案到历史记录' })
async save(@CurrentUser() user: User, @Body() body: SaveHistoryDto) {
  const task = await this.taskRepo.findOne({
    where: { task_uuid: body.taskUuid },
    relations: ['results'],
  });
  if (!task) return { code: 1, message: '任务不存在' };

  // 合并 task.results 中所有 output_data
  let results: any[] = [];
  for (const r of task.results || []) {
    if (r.output_data) {
      if (typeof r.output_data === 'string') {
        try {
          results.push(...JSON.parse(r.output_data));
        } catch {
          return { code: 1, message: '任务结果 JSON 解析失败' };
        }
      } else if (Array.isArray(r.output_data)) {
        results.push(...r.output_data);
      }
    }
  }

  if (!results.length) return { code: 1, message: '任务结果为空' };

  return this.historyService.saveBatch(
    user,
    task,
    results,
    body.schemeIndexes,
    body.module_type,
  );
}
@Post('import-gl-material')
@ApiOperation({ summary: '将历史烧结方案导入高炉原料信息库（支持多方案，按历史记录ID）' })
async importGLMaterial(
  @CurrentUser() user: User,
  @Body() body: ImportGlMaterialDto, // ✅ 使用 DTO
) {
  const result = await this.historyService.importGLMaterialFromHistory(
    user,
    body.Ids,
  );
  return result;
}
}
