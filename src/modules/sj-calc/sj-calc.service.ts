// src/calc/calc.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from './entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';

@Injectable()
export class CalcService {
  private readonly logger = new Logger(CalcService.name);

  /** FastAPI 接口地址 */
  private readonly fastApiUrl = 'http://localhost:8000';

  /** 记录处于运行中的任务 */
  private pendingTasks: Map<string, number> = new Map();

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result)
    private readonly resultRepo: Repository<Result>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 启动任务
   * - 调用 FastAPI /start 接口
   * - 将任务信息保存到数据库
   * - 返回任务 UUID
   */
  async startTask(
    fullParams: any,
    userId: number,
  ): Promise<ApiResponse<{ taskUuid: string }>> {
    try {
      this.logger.debug(
        `调用 FastAPI 启动任务，参数: ${JSON.stringify(fullParams)}`,
      );

      // 调用 FastAPI
      const res = await axios.post(`${this.fastApiUrl}/sj/start/`, fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      if (!taskUuid) {
        throw new Error(res.data?.message);
      }

      // 校验/创建用户
      let user = await this.userRepo.findOneBy({ user_id: userId });
      if (!user) {
        this.logger.warn(`用户不存在: ${userId}，自动创建`);
        user = this.userRepo.create({
          user_id: userId,
          username: `User${userId}`,
        });
        await this.userRepo.save(user);
      }

      // 入库任务信息
      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: fullParams.calculateType || 'unknown',
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user,
      });
      await this.taskRepo.save(task);

      // 加入 pending 缓存
      this.pendingTasks.set(taskUuid, Date.now());

      return ApiResponse.success({ taskUuid: taskUuid }, '任务启动成功');
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        (err instanceof Error ? err.message : String(err));
      this.logger.error(`启动任务失败: ${message}`, err?.stack);

      return ApiResponse.error<{ taskUuid: string }>(message);
    }
  }

  /**
   * 停止任务
   * - 调用 FastAPI /stop 接口
   * - 更新数据库状态
   */
  async stopTask(
    taskUuid: string,
  ): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
      if (!task) {
        return ApiResponse.error('任务不存在');
      }

      const response = await axios.post(`${this.fastApiUrl}/sj/stop/`, {
        taskUuid: taskUuid,
      });

      if (response.data?.status === 'stopped' || response.status === 200) {
        task.status = TaskStatus.STOPPED;
        await this.taskRepo.save(task);
        this.pendingTasks.delete(taskUuid);

        return ApiResponse.success({ taskUuid, status: 'stopped' }, '任务已停止');
      } else {
        return ApiResponse.error(response.data?.message || '停止失败');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`停止任务失败: ${message}`, (err as any)?.stack);

      return ApiResponse.error<{ taskUuid: string; status: string }>(
        `停止任务失败: ${message}`,
      );
    }
  }

  /**
   * 查询任务进度 & 保存结果
   * - 调用 FastAPI /progress 接口
   * - 更新数据库进度
   * - 如果完成则保存结果
   */
  async fetchAndSaveProgress(
    taskUuid: string,
  ): Promise<
    ApiResponse<{
      taskUuid: string;
      status: string;
      progress: number;
      total: number;
      results: any[];
    }>
  > {
    try {
      const task = await this.taskRepo.findOne({
        where: { task_uuid: taskUuid },
        relations: ['results'],
      });
      if (!task) return ApiResponse.error('任务不存在');

      // 调用 FastAPI 获取进度
      const response = await axios.get(`${this.fastApiUrl}/sj/progress/`, {
        params: { taskUuid: taskUuid },
      });
      const { code, message, data } = response.data;
      if (code !== 0 || !data) throw new Error(message || 'FastAPI 返回异常');

      const { status, progress, total, results } = data;

      // 根据状态更新数据库
      task.status = status === 'finished' ? TaskStatus.FINISHED : TaskStatus.RUNNING;
      task.progress = progress;
      task.total = total;
      await this.taskRepo.save(task);

      // 如果已完成，保存结果
      if (status === 'finished' && Array.isArray(results) && results.length > 0) {
        const resultEntity = this.resultRepo.create({
          task,
          output_data: results,
          is_shared: false,
          finished_at: new Date(),
        });
        await this.resultRepo.save(resultEntity);
        this.pendingTasks.delete(taskUuid);
      }

      return ApiResponse.success(
        {
          taskUuid: task.task_uuid,
          status: task.status,
          progress: task.progress,
          total: task.total,
          results: Array.isArray(results) ? results : [],
        },
        '获取任务进度成功',
      );
    } catch (err: any) {
      const message = err.response?.data?.message || (err instanceof Error ? err.message : String(err));
      this.logger.error(`获取任务进度失败: ${message}`, err?.stack);

      return ApiResponse.error(`获取任务进度失败: ${message}`);
    }
  }

  /**
   * 获取任务详情
   */
  async getTaskDetails(taskUuid: string): Promise<ApiResponse<any>> {
    try {
      const task = await this.taskRepo.findOne({
        where: { task_uuid: taskUuid },
        relations: ['results', 'logs', 'user'],
      });
      if (!task) return ApiResponse.error('任务不存在');

      return ApiResponse.success(task, '获取任务详情成功');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`获取任务详情失败: ${message}`, (err as any)?.stack);

      return ApiResponse.error(message);
    }
  }

  /**
   * 获取某个用户的任务列表
   */
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
      this.logger.error(`获取任务列表失败: ${message}`, (err as any)?.stack);

      return ApiResponse.error<any[]>(message);
    }
  }
}
