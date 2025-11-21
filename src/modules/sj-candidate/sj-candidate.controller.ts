import { Controller, Get, Post, Body, Query, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SjCandidateService } from './sj-candidate.service';
import { SaveCandidateDto } from './dto/save-candidate.dto';
import { DeleteHistoryDto } from '../history/dto/delete-history.dto';
import { ListHistoryDto } from '../history/dto/list-history.dto';

@ApiTags('烧结候选方案')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj-candidate')
export class SjCandidateController {
  constructor(private readonly candidateService: SjCandidateService) {}

  /** 批量保存候选方案 */
  @Post('save')
  @ApiOperation({ summary: '批量保存候选方案（用户选择后保存）' })
  async save(@CurrentUser() user: User, @Body() body: SaveCandidateDto) {
    return this.candidateService.saveCandidate(
      body.taskUuid,
      user.user_id,
      body.schemeIndexes,
      body.module_type,
    );
  }

  /** 查询候选方案 */
  @Get('list')
  @ApiOperation({ summary: '获取候选方案列表，可按模块类型筛选' })
  async list(@CurrentUser() user: User, @Query() query: ListHistoryDto) {
    return this.candidateService.list(user, query.module_type);
  }

  /** 删除候选方案 */
  @Post('delete')
  @ApiOperation({ summary: '删除候选方案，支持单个或批量' })
  async delete(@CurrentUser() user: User, @Body() body: DeleteHistoryDto) {
    return this.candidateService.delete(user, body.ids);
  }
}
