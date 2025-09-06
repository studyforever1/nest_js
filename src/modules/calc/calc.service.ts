// src/calc/calc.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { CalcTask, TaskStatus } from './entities/task.entity';
import { Result } from './entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';

@Injectable()
export class CalcService {
  private readonly logger = new Logger(CalcService.name);
  private readonly fastApiUrl = 'http://localhost:8000'; // FastAPI 地址

  constructor(
    @InjectRepository(CalcTask)
    private readonly taskRepo: Repository<CalcTask>,
    @InjectRepository(Result)
    private readonly resultRepo: Repository<Result>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private pendingTasks: Map<string, number> = new Map();

  /** 启动任务 */
  async startTask(
    fullParams: any,
    userId: number,
  ): Promise<ApiResponse<{ taskId: string }>> {
    try {
      this.logger.debug(`调用 FastAPI 启动任务，参数: ${JSON.stringify(fullParams)}`);

      const res = await axios.post(`${this.fastApiUrl}/sj_start/`, fullParams);
      const taskUuid = res.data?.task_id;
      if (!taskUuid) throw new Error('FastAPI 返回缺少 task_id');

      let user = await this.userRepo.findOneBy({ user_id: userId });
      if (!user) {
        this.logger.warn(`用户不存在: ${userId}，自动创建`);
        user = this.userRepo.create({ user_id: userId, username: `User${userId}` });
        await this.userRepo.save(user);
      }

      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: fullParams.calculateType || 'unknown',
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user,
      });
      await this.taskRepo.save(task);
      this.pendingTasks.set(taskUuid, Date.now());

      return ApiResponse.success({ taskId: taskUuid }, '任务启动成功');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`启动任务失败: ${message}`, (err as any)?.stack);
      return ApiResponse.error<{ taskId: string }>(message);
    }
  }

  /** 停止任务 */
  async stopTask(
    taskUuid: string,
  ): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
      if (!task) return ApiResponse.error<{ taskUuid: string; status: string }>('任务不存在');

      const response = await axios.post(`${this.fastApiUrl}/sj_stop/`, { task_id: taskUuid });
      if (response.data?.status === 'stopped' || response.status === 200) {
        task.status = TaskStatus.STOPPED;
        await this.taskRepo.save(task);
        this.pendingTasks.delete(taskUuid);
        return ApiResponse.success({ taskUuid, status: 'stopped' }, '任务已停止');
      } else {
        return ApiResponse.error<{ taskUuid: string; status: string }>(
          response.data?.message || '停止失败',
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`停止任务失败: ${message}`, (err as any)?.stack);
      return ApiResponse.error<{ taskUuid: string; status: string }>(`停止任务失败: ${message}`);
    }
  }

  /** 查询任务进度并保存结果 */
  async fetchAndSaveProgress(
    taskUuid: string,
  ): Promise<ApiResponse<{ status: string; progress: number; total: number; results: any[] }>> {
    try {
      const task = await this.taskRepo.findOne({
        where: { task_uuid: taskUuid },
        relations: ['results'],
      });
      if (!task)
        return ApiResponse.error<{ status: string; progress: number; total: number; results: any[] }>(
          '任务不存在',
        );

      const response = await axios.get(`${this.fastApiUrl}/sj_get_progress/`, {
        params: { task_id: taskUuid },
      });

      const { code, status, progress, total, results } = response.data;

      if (status === 'finished') {
        task.status = TaskStatus.FINISHED;
        task.progress = progress;
        await this.taskRepo.save(task);

        if (Array.isArray(results) && results.length > 0) {
          const resultEntity = this.resultRepo.create({
            task,
            output_data: results,
            is_shared: false,
            finished_at: new Date(),
          });
          await this.resultRepo.save(resultEntity);
        }
        this.pendingTasks.delete(taskUuid);
      } else if (status === 'running') {
        task.status = TaskStatus.RUNNING;
        task.progress = progress;
        task.total = total;
        await this.taskRepo.save(task);
      }

      return ApiResponse.success(
        { status: task.status, progress: task.progress, total: task.total, results: results || [] },
        '获取任务进度成功',
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`获取任务进度失败: ${message}`, (err as any)?.stack);
      return ApiResponse.error<{ status: string; progress: number; total: number; results: any[] }>(
        `获取任务进度失败: ${message}`,
      );
    }
  }

  /** 获取任务详情 */
  async getTaskDetails(taskUuid: string): Promise<ApiResponse<any>> {
    try {
      const task = await this.taskRepo.findOne({
        where: { task_uuid: taskUuid },
        relations: ['results', 'logs', 'user'],
      });
      if (!task) return ApiResponse.error<any>('任务不存在');
      return ApiResponse.success(task, '获取任务详情成功');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(message, (err as any)?.stack);
      return ApiResponse.error<any>(message);
    }
  }

  /** 获取用户所有任务列表 */
  async listTasks(userId: number): Promise<ApiResponse<any[]>> {
    try {
      const tasks = await this.taskRepo.find({
        where: { user: { user_id: userId } },
        order: { created_at: 'DESC' },
        relations: ['results'],
      });
      return ApiResponse.success(tasks, '获取任务列表成功');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(message, (err as any)?.stack);
      return ApiResponse.error<any[]>(message);
    }
  }
}
