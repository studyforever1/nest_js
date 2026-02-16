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
import { appConfig } from 'src/config/app.config';

@Injectable()
export class SBalanceCalcService {
  private readonly logger = new Logger(SBalanceCalcService.name);

  /** FastAPI baseUrl（只保留 域名 + 端口） */
  private readonly fastApiUrl = appConfig.api.fastApiUrl.replace(/\/$/, '');

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(SjRawMaterial) private readonly sjRawMaterialRepo: Repository<SjRawMaterial>,
    private readonly sjconfigService: SjconfigService,
  ) { }

  // ============================
  // FastAPI POST 统一封装
  // ============================
  private async apiPost(
    path: string,
    data: any,
    params: any = {},
  ): Promise<AxiosResponse<any>> {
    const url = `${this.fastApiUrl}/${path.replace(/^\/+/, '')}`;

    this.logger.debug(`[FastAPI POST] ${url}`);

    return axios.post(url, data, {
      params,
      headers: { 'Content-Type': 'application/json' },
      timeout: 60_000,
    });
  }

  // ============================
  // 启动任务
  // ============================
  async startTask(
    user: User,
    calculateType: string,
  ): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      if (!user) throw new Error('无法获取当前用户');

      const config = await this.sjconfigService.getLatestConfigByName(user, calculateType);
      if (!config) throw new Error(`未找到模块 ${calculateType} 的配置`);

      const safeNumber = (v: any, d = 0) =>
        v != null && !isNaN(Number(v)) ? Number(v) : d;

      // ============================
      // 使用配置快照 ingredientData
      // ============================
      const ingredientData: any[] = config.ingredientData || [];

      const ingredientParams: Record<string, any> = {};

      ingredientData.forEach(raw => {
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
      // ingredientResults
      // ============================
      const ingredientResultsConverted: Record<string, number> = {};

      Object.entries(config.ingredientResults || {}).forEach(([key, item]: any) => {
        ingredientResultsConverted[key] =
          item?.value != null ? Number(item.value) : 0;
      });

      // ============================
      // 完整参数
      // ============================
      const fullParams = {
        calculateType,
        ingredientData, // 🔥 保存快照
        otherSExp: config.otherSExp || {},
        extMaterial: config.extMaterial || {},
        otherSettings: config.otherSettings || {},
        ingredientLimits: ingredientLimitsClean,
        ingredientParams,
        ingredientResults: ingredientResultsConverted,
      };

      const res = await this.apiPost('s-balance/start/', fullParams);
      const taskUuid = res.data?.data?.taskUuid;

      if (!taskUuid) {
        throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');
      }

      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: calculateType,
        status: TaskStatus.RUNNING,
        parameters: fullParams, // 🔥 存完整快照
        user,
      });

      await this.taskRepo.save(task);

      return ApiResponse.success(
        { taskUuid, status: 'START' },
        '任务已创建，正在启动中',
      );
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
        const res = await this.apiPost(
          's-balance/progress/',
          {},
          { taskUuid },
        );

        const data = res.data?.data;
        const fastApiResults = data?.results || [];

        task.status =
          data?.status === 'finished'
            ? TaskStatus.FINISHED
            : TaskStatus.RUNNING;
        task.progress = Number(data?.progress ?? 0);
        await this.taskRepo.save(task);

        if (fastApiResults.length) {
          const rawResult = { ...fastApiResults[0] };

          // 🔥 从任务快照中获取名称映射
          const ingredientData: any[] = task.parameters?.ingredientData || [];

          const idToName: Record<string, string> = {};
          ingredientData.forEach(item => {
            idToName[String(item.id)] = item.name;
          });

          if (rawResult['详细数据']) {
            Object.entries(rawResult['详细数据']).forEach(([id, val]: any) => {
              rawResult['详细数据'][id] = {
                ...val,
                name: idToName[id] || id,
                配比: Number(val.配比 ?? 0),
              };
            });
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
        const resultEntity = await this.resultRepo.findOne({
          where: { task: { task_uuid: taskUuid } },
        });
        if (resultEntity?.output_data?.length) {
          results = resultEntity.output_data;
        }
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
  // 保存结果
  // ============================
  private async saveResults(task: Task, results: any[]): Promise<void> {
    if (!results?.length) return;

    await this.resultRepo.save(
      this.resultRepo.create({
        task,
        output_data: results,
        is_shared: false,
        finished_at: new Date(),
      }),
    );
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
