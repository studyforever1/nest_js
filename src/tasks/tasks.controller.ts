import { Controller, Post, Param, Body } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('create/:userId')
  createTask(@Param('userId') userId: number, @Body() body: any) {
    return this.tasksService.createTask(userId, body.module_type);
  }

  @Post('run/:taskId')
  runTask(@Param('taskId') taskId: number, @Body() body: any) {
    return this.tasksService.runCalculation(taskId, body);
  }
}
