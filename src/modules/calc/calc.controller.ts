import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { CalcService } from './calc.service';

@Controller('sj')
export class CalcController {
  constructor(private readonly calcService: CalcService) {}

  /** 启动计算任务 */
  @Post('start')
async start(
  @Body() body: {
    calculateType: string;
    ingredientParams: any;
    ingredientLimits: any;
    chemicalLimits: any;
    otherSettings: any;
    userId: number;
  },
) {
  const { userId } = body;
  // 直接把整个 body 传给 startTask
  return this.calcService.startTask(body, userId);
}


  /** 停止计算任务 */
  @Post('stop')
  async stop(@Body('task_id') task_id: string) {
    return this.calcService.stopTask(task_id);
  }

  /** 查询任务进度，同时将结果保存到数据库 */
  @Get('progress/:task_id')
  async getProgress(@Param('task_id') task_id: string) {
    return this.calcService.fetchAndSaveProgress(task_id);
  }

  /** 查询任务详情，包括结果和日志 */
  @Get('task/:task_id')
  async getTask(@Param('task_id') task_id: string) {
    return this.calcService.getTaskDetails(task_id);
  }
}
