// ============================
// SjFixedCalcService
// ============================
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { SjconfigService } from '../sj-config/sj-config.service';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { appConfig } from 'src/config/app.config';
import { formatSJResultFull, sortSJResult } from '../../common/formatters/sj.formatter';

@Injectable()
export class SjFixedCalcService {
    private readonly logger = new Logger(SjFixedCalcService.name);

    // ✅ FastAPI 基础地址（统一去掉末尾 /）
    private readonly fastApiBaseUrl = appConfig.api.fastApiUrl.replace(/\/$/, '');

    constructor(
        @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
        @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(SjRawMaterial) private readonly sjRawMaterialRepo: Repository<SjRawMaterial>,
        private readonly sjconfigService: SjconfigService,
    ) {
        this.logger.log(`FastAPI BaseURL => ${this.fastApiBaseUrl}`);
    }

    // ============================
    // FastAPI POST 统一封装（唯一出口）
    // ============================
    private async apiPost(
        path: string,
        data: any,
        params: any = {},
    ): Promise<AxiosResponse<any>> {
        const url = `${this.fastApiBaseUrl}/${path.replace(/^\/+/, '')}`;

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

        // =========================
        // 1️⃣ 使用 ingredientData 快照
        // =========================
        const ingredientData: any[] = config.ingredientData || [];

        // 原料配比参数
        const ingredientParams: Record<string, any> = {};
        ingredientData.forEach(raw => {
            if (!raw.enabled) return;
            const comp = raw.composition || {};
            ingredientParams[raw.id] = {
                ...comp,
                TFe: comp.TFe ?? 0,
                烧损: comp['烧损'] ?? 0,
                价格: comp['价格'] ?? 0,
                库存: raw.inventory ?? 0,
            };
        });

        // 原料限制
        const ingredientLimitsClean: Record<string, any> = {};
        const limits = config.ingredientLimits || {};
        Object.keys(limits).forEach(id => {
            const { name, ...rest } = limits[id];
            ingredientLimitsClean[id] = {
                low_limit: safeNumber(rest.low_limit),
                top_limit: safeNumber(rest.top_limit),
                lose_index: safeNumber(rest.lose_index),
            };
        });

        // 原料结果（默认值）
        const ingredientResults = this.buildIngredientResults(config.ingredientResults);

        // 组装完整参数
        const fullParams = {
            calculateType,
            ingredientData, // 整个快照传给 FastAPI
            ingredientParams,
            ingredientLimits: ingredientLimitsClean,
            ingredientResults,
            chemicalLimits: config.chemicalLimits || {},
            otherSettings: config.otherSettings || {},
        };

        this.logger.debug('=== Full Params for FastAPI ===');
        this.logger.debug(JSON.stringify(fullParams, null, 2));

        // =========================
        // 2️⃣ 调用 FastAPI 启动任务
        // =========================
        const res = await this.apiPost('sj-fixed/start/', fullParams);
        const taskUuid = res.data?.data?.taskUuid;
        if (!taskUuid) throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');

        // =========================
        // 3️⃣ 保存任务
        // =========================
        const task = this.taskRepo.create({
            task_uuid: taskUuid,
            module_type: calculateType,
            status: TaskStatus.RUNNING,
            parameters: fullParams,
            user,
        });
        await this.taskRepo.save(task);

        return ApiResponse.success(
            { taskUuid, status: 'START' },
            '任务已创建，正在启动中',
        );
    } catch (err) {
        return this.handleError(err, '启动任务失败');
    }
}
    // ============================
    // 查询进度 / 结果
    // ============================
async getProgress(taskUuid: string): Promise<ApiResponse<any>> {
  try {
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });

    if (!task) {
      return ApiResponse.success({
        taskUuid,
        status: 'initializing',
        progress: 0,
        total: 0,
        results: []
      });
    }

    let results: any[] = [];

    const parameters = task.parameters || {};
    const ingredientData: any[] = parameters.ingredientData || [];

    const idNameMap: Record<string, string> = {};
    const idCategoryMap: Record<string, string> = {};

    ingredientData.forEach(item => {
      if (item?.id != null) {
        idNameMap[String(item.id)] = item.name || '';
        idCategoryMap[String(item.id)] = item.category || '';
      }
    });

    // ============================
    // 安全调用 FastAPI
    // ============================
    let data: any = null;

    if (task.status !== TaskStatus.FINISHED) {
      try {
        const res = await this.apiPost('sj-fixed/progress/', {}, { taskUuid });
        data = res.data?.data;
      } catch (err: any) {
        const status = err?.response?.status;

        if (status === 404) {
          this.logger.warn(`FastAPI 404: ${taskUuid} 未就绪`);
        } else {
          this.logger.error(`FastAPI 错误: ${err.message}`);
        }

        data = null;
      }

      // ============================
      // 有数据才处理
      // ============================
      if (data && Array.isArray(data.results)) {

        results = data.results;

        task.status = data.status === 'finished'
          ? TaskStatus.FINISHED
          : TaskStatus.RUNNING;

        task.progress = Number(data.progress ?? 0);

        await this.taskRepo.save(task);

        // ============================
        // ⭐ 不要只取 [0]，全部处理
        // ============================
        results = results.map(item => ({
          ...item,
          方案序号: item['方案序号'] ?? 1,
        }));

        // ============================
        // 任务完成才做深度处理
        // ============================
        if (task.status === TaskStatus.FINISHED) {

          results = results.map(item =>
            formatSJResultFull(
              item,
              idNameMap,
              idCategoryMap,
              parameters.ingredientLimits,
              parameters.chemicalLimits,
            )
          );

          // 成本排名
          results.sort((a, b) =>
            a["主要参数"]["成本(元/t)"] - b["主要参数"]["成本(元/t)"]
          );
          results.forEach((item, idx) => item.成本排名 = idx + 1);

          // 吨度价排名
          results.sort((a, b) =>
            a["主要参数"].吨度价 - b["主要参数"].吨度价
          );
          results.forEach((item, idx) => item.吨度价排名 = idx + 1);

          await this.saveResults(task, results);
        }
      }
    }

    // ============================
    // 已完成 → 从数据库读取
    // ============================
    else {
      const resultEntity = await this.resultRepo.findOne({
        where: { task: { task_uuid: taskUuid } },
      });

      if (resultEntity?.output_data?.length) {
        results = resultEntity.output_data.map(item => sortSJResult(item));
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
    // 保存结果（upsert：先查后存，防止重复插入）
    // ============================
    private async saveResults(task: Task, results: any[]): Promise<void> {
        if (!results?.length) return;
        let entity = await this.resultRepo.findOne({
            where: { task: { task_uuid: task.task_uuid } },
        });
        if (!entity) {
            entity = this.resultRepo.create({
                task,
                output_data: results,
                is_shared: false,
                finished_at: new Date(),
            });
        } else {
            entity.output_data = results;
            entity.finished_at = new Date();
        }
        await this.resultRepo.save(entity);
    }

    // ============================
    // ingredientResults 转换
    // ============================
    private buildIngredientResults(
        ingredientResults: Record<string, { name?: string; value: number }>,
    ): Record<string, number> {
        const result: Record<string, number> = {};
        Object.entries(ingredientResults || {}).forEach(([key, item]) => {
            if (item?.value == null) return;
            result[key.replace(/_$/, '')] = Number(item.value);
        });
        return result;
    }

    // ============================
    // 统一错误处理
    // ============================
    private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
        return ApiResponse.error(message);
    }
}
