import { Controller, Post, Get, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SjFixedCalcService } from './sj-fixed-calc.service';
import { StartTask2Dto } from './dto/start-task.dto';
import { ProgressDto } from './dto/progress.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';

@ApiBearerAuth('JWT')
@ApiTags('烧结固定配料计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj-fixed')
export class SjFixedCalcController {
  constructor(private readonly service: SjFixedCalcService) {}

  /**
   * 启动计算任务
   */
  @Post('start')
  @Permissions('sj-fixed:calc')
  @ApiOperation({ summary: '启动烧结固定配料计算任务' })
  @ApiOkResponseData(StartTask2Dto)
  @ApiErrorResponse()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async start(
    @CurrentUser() user: User,
    @Body() dto: StartTask2Dto,
  ) {
    return this.service.startTask(user, dto.calculateType);
  }

  /**
   * 查询任务进度
   */
  @Get('progress')
  @Permissions('sj-fixed:calc')
  @ApiOperation({ summary: '获取烧结固定配料计算任务结果' })
  @ApiOkResponseData(ProgressDto)
  @ApiErrorResponse()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async progress(
    @Query() query: ProgressDto,
  ) {
    return this.service.getProgress(query.taskUuid);
  }
}
