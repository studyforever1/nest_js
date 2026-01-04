import { Controller, Post, Get, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { GlFixedCalcService } from './gl-fixed-calc.service';
import { StartTask3Dto } from './dto/start-task.dto';
import { Progress3Dto } from './dto/progress.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';

@ApiBearerAuth('JWT')
@ApiTags('高炉固定配料计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('gl-fixed')
export class GlFixedCalcController {
  constructor(private readonly service: GlFixedCalcService) {}

  /**
   * 启动计算任务
   */
  @Post('start')
  @Permissions('gl-fixed:calc')
  @ApiOperation({ summary: '启动高炉固定配料计算任务' })
  @ApiOkResponseData(StartTask3Dto)
  @ApiErrorResponse()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async start(@CurrentUser() user: User, @Body() dto: StartTask3Dto) {
    return this.service.startTask(dto.calculateType, user);
  }

  /**
   * 查询任务进度
   */
  @Get('progress')
  @Permissions('gl-fixed:calc')
  @ApiOperation({ summary: '获取高炉固定配料计算任务结果' })
  @ApiOkResponseData(Progress3Dto)
  @ApiErrorResponse()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async progress(@Query() query: Progress3Dto) {
    return this.service.getProgress(query.taskUuid);
  }
}
