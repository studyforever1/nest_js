import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../database/entities/task.entity';
import { User } from '../database/entities/user.entity';
import axios, { AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>, // 可选：确保用户存在
    private readonly configService: ConfigService,
  ) {}

  /** 创建任务 */
  async createTask(userId: number, module_type: string): Promise<Task> {
    // 校验用户是否存在
    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const task = this.taskRepo.create({
      task_uuid: crypto.randomUUID(),
      module_type,
      status: 'pending',
      user: user,
    });

    return this.taskRepo.save(task);
  }

  /** 调用 FastAPI 执行计算 */
  async runCalculation(taskId: number, params: any): Promise<any> {
    const task = await this.taskRepo.findOne({ where: { task_id: taskId }, relations: ['user'] });
    if (!task) throw new NotFoundException('Task not found');

    // 更新任务状态为 running
    task.status = 'running';
    await this.taskRepo.save(task);

    const fastapiUrl = this.configService.get<string>('FASTAPI_URL');
    if (!fastapiUrl) throw new InternalServerErrorException('FASTAPI_URL 未配置');

    let resultData: any;
    try {
      // axios 增加超时，防止挂起
      const response: AxiosResponse = await axios.post(fastapiUrl, params, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000, // 30秒超时
      });

      resultData = response.data;

      task.status = 'finished';
      await this.taskRepo.save(task);

      return resultData;
    } catch (error) {
      task.status = 'failed';
      await this.taskRepo.save(task);

      console.error('调用 FastAPI 出错:', error.response?.data || error.message || error);
      throw new InternalServerErrorException('调用 FastAPI 失败');
    }
  }

  /** 查询任务状态 */
  async getTaskStatus(taskId: number): Promise<{ status: string; task_uuid: string }> {
    const task = await this.taskRepo.findOne({ where: { task_id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return { status: task.status, task_uuid: task.task_uuid };
  }
}
