import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from './entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { SjconfigService } from '../sj-config/sj-config.service';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { In } from 'typeorm';

@Injectable()
export class CalcService {
  private readonly logger = new Logger(CalcService.name);
  private readonly fastApiUrl = process.env.FASTAPI_URL;
  private pendingTasks: Map<string, number> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(SjRawMaterial) private readonly sjRawMaterialRepo: Repository<SjRawMaterial>,
    private readonly sjconfigService: SjconfigService,
  ) {}
    /** 获取任务详情 */
async getTaskDetails(taskUuid: string): Promise<ApiResponse<any>> {
  try {
    // 查询任务及关联结果、日志和用户信息
    const task = await this.findTask(taskUuid, ['results', 'logs', 'user']);
    if (!task) return ApiResponse.error('任务不存在');

    return ApiResponse.success(task, '获取任务详情成功');
  } catch (err: unknown) {
    return this.handleError(err, '获取任务详情失败');
  }
}
  /** 构建 ingredientParams：将原料 id 转为 name → composition */
  private async buildIngredientParams(ingredientIds: number[]): Promise<Record<string, any>> {
    if (!ingredientIds || ingredientIds.length === 0) return {};

    const raws = await this.sjRawMaterialRepo.find({
  where: {
    id: In(ingredientIds),
    enabled: true,
  },
});

    const ingredientParams: Record<string, any> = {};

    raws.forEach(raw => {
      if (!raw.composition) return;

      ingredientParams[raw.name] = {
        ...raw.composition,
        TFe: raw.composition.TFe ?? 0,
        烧损: raw.composition['烧损'] ?? 0,
        价格: raw.composition['价格'] ?? 0,
      };
    });

    return ingredientParams;
  }

  /** 启动任务（从数据库组装参数） */
  async startTask(moduleName: string, user: User): Promise<ApiResponse<{ taskUuid: string }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      // 从数据库取配置
      const config = await this.sjconfigService.getLatestConfigByName(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      // 将 ingredientParams 从 id 转为原料信息
      const ingredientParams = await this.buildIngredientParams(config.ingredientParams || []);

      const fullParams = {
        calculateType: moduleName,
        ingredientParams,
        ingredientLimits: config.ingredientLimits || {},
        chemicalLimits: config.chemicalLimits || {},
        otherSettings: config.otherSettings || {},
      };

      this.logger.debug(`调用 FastAPI 启动任务，参数: ${JSON.stringify(fullParams)}`);

      const res = await this.apiPost('/sj/start/', fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      if (!taskUuid) throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');

      // 存 Task
      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: moduleName,
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user,
      });
      await this.taskRepo.save(task);

      this.pendingTasks.set(taskUuid, Date.now());
      return ApiResponse.success({ taskUuid }, '任务启动成功');
    } catch (err: any) {
      return this.handleError(err, '启动任务失败');
    }
  }

  /** 停止任务 */
  async stopTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      const res = await this.apiPost('/sj/stop/', { taskUuid });
      if (res.data?.status === 'stopped' || res.status === 200) {
        task.status = TaskStatus.STOPPED;
        await this.taskRepo.save(task);
        this.pendingTasks.delete(taskUuid);
        return ApiResponse.success({ taskUuid, status: 'stopped' }, '任务已停止');
      }
      return ApiResponse.error(res.data?.message || '停止失败');
    } catch (err: unknown) {
      return this.handleError(err, '停止任务失败');
    }
  }

  /** 查询任务进度 */
  async fetchAndSaveProgress(taskUuid: string): Promise<ApiResponse<any>> {
    try {
      const task = await this.findTask(taskUuid, ['results']);
      if (!task) return ApiResponse.error('任务不存在');

      const res = await this.apiGet('/sj/progress/', { taskUuid });
      const { code, message, data } = res.data;
      if (code !== 0 || !data) throw new Error(message || 'FastAPI 返回异常');

      task.status = this.mapStatus(data.status);
      task.progress = data.progress;
      task.total = data.total;
      await this.taskRepo.save(task);

      if (task.status === TaskStatus.FINISHED && Array.isArray(data.results) && data.results.length) {
        await this.saveResults(task, data.results);
        this.pendingTasks.delete(taskUuid);
      }

      return ApiResponse.success({
        taskUuid: task.task_uuid,
        status: task.status,
        progress: task.progress,
        total: task.total,
        results: Array.isArray(data.results) ? data.results : [],
      }, '获取任务进度成功');
    } catch (err: any) {
      return this.handleError(err, '获取任务进度失败');
    }
  }

  /** ----- 私有方法 ----- */

  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> {
    try {
      return await axios.post(`${this.fastApiUrl}${path}`, data);
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || '接口请求失败');
    }
  }

  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> {
    try {
      return await axios.get(`${this.fastApiUrl}${path}`, { params });
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.message || '接口请求失败');
    }
  }

  private async getOrCreateUser(userId: number): Promise<User> {
    let user = await this.userRepo.findOneBy({ user_id: userId });
    if (!user) {
      this.logger.warn(`用户不存在: ${userId}，自动创建`);
      user = this.userRepo.create({ user_id: userId, username: `User${userId}` });
      await this.userRepo.save(user);
    }
    return user;
  }

  private async findTask(taskUuid: string, relations: string[] = []): Promise<Task | null> {
    return this.taskRepo.findOne({ where: { task_uuid: taskUuid }, relations });
  }

  private async saveResults(task: Task, results: any[]): Promise<void> {
    const resultEntity = this.resultRepo.create({
      task,
      output_data: results,
      is_shared: false,
      finished_at: new Date(),
    });
    await this.resultRepo.save(resultEntity);
  }

  private mapStatus(status: string): TaskStatus {
    return status === 'finished' ? TaskStatus.FINISHED : TaskStatus.RUNNING;
  }

  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
    return ApiResponse.error(message);
  }
}
