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
import { History } from '../history/entities/history.entity';


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
  ) { }


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
  async startTask(moduleName: string, user: User): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      // 从数据库取配置
      const config = await this.sjconfigService.getLatestConfigByName(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      // 使用 ID 直接构建 ingredientParams（composition 信息也可传，但 key 用 ID）
      const ingredientIds = config.ingredientParams || [];
      const raws = await this.sjRawMaterialRepo.find({
        where: { id: In(ingredientIds), enabled: true }
      });

      const ingredientParams: Record<number, any> = {};
      raws.forEach(raw => {
        ingredientParams[raw.id] = {
          ...raw.composition,
          TFe: raw.composition?.TFe ?? 0,
          烧损: raw.composition?.['烧损'] ?? 0,
          价格: raw.composition?.['价格'] ?? 0,
        };
      });
      // ingredientLimits: 去掉 name 字段
      const ingredientLimitsClean: Record<string, any> = {};
      Object.keys(config.ingredientLimits || {}).forEach(id => {
        const { name, ...limits } = config.ingredientLimits[id];
        ingredientLimitsClean[id] = limits;
      });
      const fullParams = {
        calculateType: moduleName,
        ingredientParams,       // key = ID
        ingredientLimits: ingredientLimitsClean,
        chemicalLimits: config.chemicalLimits || {},
        otherSettings: config.otherSettings || {},
      };

      console.log('=== fullParams JSON (ID 计算) ===');
      console.log(JSON.stringify(fullParams, null, 2));

      const res = await this.apiPost('/sj/start/', fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      const resultsById = res.data?.data?.results; // 假设 FastAPI 返回 {id: value}

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

      // 把结果 ID → name
      const idNameMap: Record<number, string> = {};
      raws.forEach(raw => idNameMap[raw.id] = raw.name);

      const resultMap: Record<string, any> = {};
      if (resultsById) {
        Object.keys(resultsById).forEach(idStr => {
          const id = Number(idStr);
          const name = idNameMap[id];
          if (name) resultMap[name] = resultsById[id];
        });
      }

      return ApiResponse.success({ taskUuid, resultMap }, '任务启动成功 (ID → Name 映射)');
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
  /** 查询任务进度（带ID转名称） */
async fetchAndSaveProgress(taskUuid: string): Promise<ApiResponse<any>> {
  try {
    const task = await this.findTask(taskUuid, ['results']);
    if (!task) return ApiResponse.error('任务不存在');

    const res = await this.apiGet('/sj/progress/', { taskUuid });
    const { code, message, data } = res.data;
    if (code !== 0 || !data) throw new Error(message || 'FastAPI 返回异常');

    // --- 获取原料 ID → 名称映射 ---
    // 收集所有 result 中的原料ID
    const idSet = new Set<number>();
    for (const result of data.results || []) {
      const rawMix = result["原料配比"] || {};
      Object.keys(rawMix).forEach(idStr => {
        if (/^\d+$/.test(idStr)) idSet.add(Number(idStr));
      });
    }

    const raws = await this.sjRawMaterialRepo.find({
      where: { id: In([...idSet]) }
    });
    const idNameMap: Record<string, string> = {};
    raws.forEach(raw => idNameMap[String(raw.id)] = raw.name);

    // --- 递归替换 原料配比 中的 ID ---
    const resultsMapped = (data.results || []).map(item => {
      const mapped = { ...item };

      // 替换 "原料配比" 的键名
      if (item["原料配比"]) {
        const newMix: Record<string, any> = {};
        Object.entries(item["原料配比"]).forEach(([id, val]) => {
          const name = idNameMap[id] || id; // 如果找不到就保留ID
          newMix[name] = val;
        });
        mapped["原料配比"] = newMix;
      }

      return mapped;
    });

    // --- 更新任务状态 ---
    task.status = this.mapStatus(data.status);
    task.progress = data.progress;
    task.total = data.total;
    await this.taskRepo.save(task);

    // --- 如果任务完成则保存结果 ---
    if (task.status === TaskStatus.FINISHED && resultsMapped.length) {
      await this.saveResults(task, resultsMapped);
      this.pendingTasks.delete(taskUuid);
    }

    // --- 返回前端 ---
    return ApiResponse.success({
      taskUuid: task.task_uuid,
      status: task.status,
      progress: task.progress,
      total: task.total,
      results: resultsMapped,
    }, '获取任务进度成功 (原料ID已转换为名称)');

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
