import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { SjconfigService } from '../sj-config/sj-config.service';

@Injectable()
export class SBalanceCalcService {
  private readonly logger = new Logger(SBalanceCalcService.name);

  private readonly fastApiUrl = (process.env.FASTAPI_URL || 'http://127.0.0.1:8000').replace(/\/?$/, '/');

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(SjRawMaterial) private readonly sjRawMaterialRepo: Repository<SjRawMaterial>,
    private readonly sjconfigService: SjconfigService,
  ) {}

  // ============================
  // 启动任务
  // ============================
async startTask(
  user: User,
  calculateType: string
): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
  try {
    if (!user) throw new Error('无法获取当前用户');

    const config = await this.sjconfigService.getLatestConfigByName(user, calculateType);
    if (!config) throw new Error(`未找到模块 ${calculateType} 的配置`);
    console.log('配置内容：', config);

    const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

    // ============================
    // 原料参数
    // ============================
    const ingredientIds = config.ingredientParams || [];
    const raws = await this.sjRawMaterialRepo.find({
      where: { id: In(ingredientIds), enabled: true }
    });

    const ingredientParams: Record<string, any> = {};
    raws.forEach(raw => {
      const comp = raw.composition || {};
      ingredientParams[raw.id] = {
        ...comp,
        TFe: comp.TFe ?? 0,
        烧损: comp['烧损'] ?? 0,
        价格: comp['价格'] ?? 0,
        库存: raw.inventory ?? 0,
      };
    });

    // ============================
    // 配料上下限
    // ============================
    const ingredientLimitsClean: Record<string, any> = {};
    Object.keys(config.ingredientLimits || {}).forEach(id => {
      const { name, ...limits } = config.ingredientLimits[id];
      ingredientLimitsClean[id] = {
        low_limit: safeNumber(limits.low_limit),
        top_limit: safeNumber(limits.top_limit),
        lose_index: safeNumber(limits.lose_index),
      };
    });

    // ============================
    // ingredientResults 转换 key:value
    // ============================
    const ingredientResultsRaw: Record<string, { name?: string; value?: number | null }> =
      config.ingredientResults || {};
    const ingredientResultsConverted: Record<string, number> = {};
    Object.entries(ingredientResultsRaw).forEach(([key, item]) => {
      ingredientResultsConverted[key] = item?.value != null ? Number(item.value) : 0;
    });

    // ============================
    // 组装完整参数
    // ============================
    const fullParams = {
      calculateType,
      otherSExp: config.otherSExp || {},
      extMaterial: config.extMaterial || {},
      otherSettings: config.otherSettings || {},
      ingredientLimits: ingredientLimitsClean,
      ingredientParams,
      ingredientResults: ingredientResultsConverted,
    };

    this.logger.debug('=== Full Params for FastAPI ===');
    this.logger.debug(JSON.stringify(fullParams, null, 2));

    // ============================
    // 调用 FastAPI 启动任务
    // ============================
    const res = await axios.post(`${this.fastApiUrl}s-balance/start/`, fullParams);
    const taskUuid = res.data?.data?.taskUuid;
    if (!taskUuid) throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');

    const task = this.taskRepo.create({
      task_uuid: taskUuid,
      module_type: calculateType,
      status: TaskStatus.RUNNING,
      parameters: fullParams,
      user,
    });
    await this.taskRepo.save(task);

    return ApiResponse.success({ taskUuid, status: 'START' }, '任务已创建，正在启动中');
  } catch (err: any) {
    return this.handleError(err, '启动任务失败');
  }
}

  // ============================
  // 查询进度 / 结果
  // ============================
  async getProgress(taskUuid: string): Promise<ApiResponse<any>> {
    try {
      const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
      if (!task) return ApiResponse.error('任务不存在');

      let results: any[] = [];

      if (task.status !== TaskStatus.FINISHED) {
        const res: AxiosResponse = await axios.post(
          `${this.fastApiUrl}s-balance/progress/`,
          {},
          { params: { taskUuid }, headers: { 'Content-Type': 'application/json' } }
        );

        const data = res.data?.data;
        const fastApiResults = data?.results || [];

        task.status = data?.status === 'finished' ? TaskStatus.FINISHED : TaskStatus.RUNNING;
        task.progress = Number(data?.progress ?? 0);
        await this.taskRepo.save(task);

        if (fastApiResults.length) {
          const rawResult = { ...fastApiResults[0] };

          // 原料配比处理（乘100）
          if (rawResult['详细数据']) {
            const rawIds = Object.keys(rawResult['详细数据']).map(id => id);
            const raws = await this.sjRawMaterialRepo.findBy({ id: In(rawIds.map(Number)) });
            const idToName: Record<string, string> = {};
            raws.forEach(r => (idToName[r.id.toString()] = r.name || r.id.toString()));

            const finalRaw: Record<string, any> = {};
            Object.entries(rawResult['详细数据']).forEach(([id, val]: [string, any]) => {
              finalRaw[id] = {
                ...val,
                name: idToName[id] || id,
                配比: Number(val.配比 ?? 0),
              };
            });

            rawResult['详细数据'] = finalRaw;
          }

          results.push({
            ...rawResult,
            方案序号: rawResult['方案序号'] ?? 1,
          });

          if (task.status === TaskStatus.FINISHED) {
            await this.saveResults(task, results);
          }
        }
      } else {
        const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
        if (resultEntity?.output_data?.length) results = resultEntity.output_data;
      }

      return ApiResponse.success({
        taskUuid,
        status: task.status,
        progress: task.progress,
        total: results.length,
        results,
      });
    } catch (err: any) {
      return this.handleError(err, '获取任务结果失败');
    }
  }

  // ============================
  // 保存结果到数据库
  // ============================
  private async saveResults(task: Task, results: any[]): Promise<void> {
    if (!results || !results.length) return;
    await this.resultRepo.save(
      this.resultRepo.create({
        task,
        output_data: results,
        is_shared: false,
        finished_at: new Date(),
      })
    );
  }

  // ============================
  // ingredientResults 转换
  // ============================
// ============================
// ingredientResults 转换
// ============================
private buildIngredientResults(
  ingredientResults: Record<string, number | null | undefined>
): Record<string, number> {
  const result: Record<string, number> = {};
  Object.entries(ingredientResults || {}).forEach(([key, value]) => {
    // 如果值为 null 或 undefined，默认使用 0
    result[key] = value != null ? Number(value) : 0;
  });
  return result;
}


  // ============================
  // 错误处理
  // ============================
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
    return ApiResponse.error(message);
  }
}
