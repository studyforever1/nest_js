import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { CalcTask, TaskStatus } from './entities/task.entity';
import { Result } from './entities/result.entity';
import { User } from '../users/entities/user.entity';


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
  ) { }

  private pendingTasks: Map<string, number> = new Map(); // taskUuid -> timestamp

  /** 启动任务：前端传完整参数对象 fullParams + userId */
  /** 启动任务：前端传完整参数对象 fullParams + userId */
  async startTask(fullParams: any, userId: number) {
    try {
      this.logger.debug(`调用 FastAPI 启动任务，参数: ${JSON.stringify(fullParams)}`);

      const res = await axios.post(`${this.fastApiUrl}/sj_start/`, fullParams);
      const taskUuid = res.data?.task_id;
      if (!taskUuid) throw new Error('FastAPI 返回缺少 task_id');

      // 检查或创建用户
      try {
        let user = await this.userRepo.findOneBy({ user_id: userId });
        if (!user) {
          this.logger.warn(`用户不存在: ${userId}，自动创建`);
          user = this.userRepo.create({
            user_id: userId,
            username: `User${userId}`,
          });
          await this.userRepo.save(user);
        }
        // 保存任务
        const task = this.taskRepo.create({
          task_uuid: taskUuid,
          module_type: fullParams.calculateType || 'unknown',
          status: TaskStatus.RUNNING,
          parameters: fullParams,
          user: user,
        });
        await this.taskRepo.save(task);

        this.pendingTasks.set(taskUuid, Date.now());
      } catch (err) {
        this.logger.error('数据库操作失败', err.stack);
        throw new Error('数据库操作失败');
      }
      // ⚠️ 前端要的 key 是 taskId
      return { taskId: taskUuid };
    } catch (err) {
      this.logger.error(`启动任务失败: ${err.message}`, err.stack);
      throw err;
    }
  }


  /** 停止任务 */
  async stopTask(taskUuid: string) {
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (!task) {
      throw new NotFoundException(`任务不存在: ${taskUuid}`);
    }

    const url = `${this.fastApiUrl}/sj_stop/`;
    const payload = { task_id: taskUuid };

    this.logger.log(`准备调用 FastAPI 停止任务: ${url}`);
    this.logger.log(`发送参数: ${JSON.stringify(payload)}`);

    try {
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      this.logger.log(`FastAPI 返回状态码: ${response.status}`);
      this.logger.log(`FastAPI 返回数据: ${JSON.stringify(response.data)}`);

      if (response.data?.status === 'stopped' || response.status === 200) {
        task.status = TaskStatus.STOPPED; // ✅ 改成 STOPPED 状态
        await this.taskRepo.save(task);

        this.pendingTasks.delete(taskUuid);

        return { taskUuid, status: 'stopped' };
      } else {
        this.logger.warn(`FastAPI 未能成功停止任务: ${JSON.stringify(response.data)}`);
        throw new Error(`FastAPI stopTask 失败: ${response.data?.message || '未知错误'}`);
      }
    } catch (err) {
      this.logger.error(`停止任务失败: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`停止任务失败: ${err.message}`);
    }
  }


  /** 前端轮询接口调用：获取 FastAPI 进度并保存结果 */
  async fetchAndSaveProgress(taskUuid: string) {
  // 查询任务及其关联结果
  const task = await this.taskRepo.findOne({
    where: { task_uuid: taskUuid },
    relations: ['results'],
  });
  if (!task) throw new NotFoundException(`任务不存在: ${taskUuid}`);

  try {
    // 调用 FastAPI 获取任务进度
    const response = await axios.get(`${this.fastApiUrl}/sj_get_progress/`, {
      params: { task_id: taskUuid },
    });

    const { code, status, progress, total, results } = response.data;

    // 更新任务状态和进度
    if (status === 'finished') {
      task.status = TaskStatus.FINISHED;
      task.progress = progress;
      await this.taskRepo.save(task);

      // 保存计算结果到 result 表
      if (Array.isArray(results) && results.length > 0) {
        const resultEntity = this.resultRepo.create({
          task,
          output_data: results,
          is_shared: false,
          finished_at: new Date(),
        });
        await this.resultRepo.save(resultEntity);
      }

      this.pendingTasks.delete(taskUuid); // 移除轮询任务
    } else if (status === 'running') {
      task.status = TaskStatus.RUNNING;
      task.progress = progress;
      task.total = total;
      await this.taskRepo.save(task);
    }

    // 返回完整数据给前端
    return {
      code,
      status: task.status,
      progress: task.progress,
      total: task.total,
      results: results || [],
    };
  } catch (err) {
    this.logger.error(`获取任务进度失败: ${err.message}`, err.stack);
    throw err;
  }
}

  /** 获取任务详情 */
  async getTaskDetails(taskUuid: string) {
    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid },
      relations: ['results', 'logs', 'user'],
    });
    if (!task) throw new NotFoundException(`任务不存在: ${taskUuid}`);
    return task;
  }

  /** 获取用户所有任务列表 */
  async listTasks(userId: number) {
    return this.taskRepo.find({
      where: { user: { user_id: userId } },
      order: { created_at: 'DESC' },
      relations: ['results'],
    });
  }
}
