import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { GlConfigService } from '../gl-config/gl-config.service';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';
import { appConfig } from '../../config/app.config';

@Injectable()
export class GlFixedCalcService {
  private readonly logger = new Logger(GlFixedCalcService.name);
  private readonly fastApiUrl = appConfig.api.fastApiUrl;

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo) private readonly glRawMaterialRepo: Repository<GlMaterialInfo>,
    @InjectRepository(GlFuelInfo) private readonly glFuelRepo: Repository<GlFuelInfo>,
    private readonly glconfigService: GlConfigService,
  ) {}

  // ============================
  // 启动任务
  // ============================
async startTask(
  moduleName: string,
  user: User
): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
  try {
    this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

    // ---------------- 获取模块配置 ----------------
    const config = await this.glconfigService.getLatestIngredients(user, moduleName);
    if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

    const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

    // ---------------- 原料参数 ----------------
    const ingredientData = config.ingredientData || [];
    const ingredientParams: Record<string, any> = {};
    const ingredientIdNameMap: Record<number, string> = {};

    ingredientData.forEach(raw => {
      const composition = typeof raw.composition === 'string' ? JSON.parse(raw.composition) : raw.composition || {};
      ingredientParams[String(raw.id)] = Object.fromEntries(
        Object.entries({
          ...composition,
          TFe: composition?.TFe ?? 0,
          库存: raw.inventory ?? 0,
          返矿率: composition?.['返矿率'] ?? 0,
          返矿价格: composition?.['返矿价格'] ?? 0,
          干基价格: composition?.['干基价格'] ?? 0,
        }).map(([k, v]) => [k, safeNumber(v)])
      );
      if (raw.name) ingredientIdNameMap[raw.id] = raw.name;
    });

    // 原料限额
    const ingredientLimits: Record<string, any> = {};
    Object.entries(config.ingredientLimits || {}).forEach(([id, limit]: any) => {
      ingredientLimits[id] = {
        low_limit: safeNumber(limit.low_limit),
        top_limit: safeNumber(limit.top_limit),
      };
    });

    // ---------------- 燃料参数 ----------------
    const fuelData = config.fuelData || [];
    const fuelParams: Record<string, any> = {};
    const fuelIdNameMap: Record<number, string> = {};

    fuelData.forEach(fuel => {
      const composition = typeof fuel.composition === 'string' ? JSON.parse(fuel.composition) : fuel.composition || {};
      fuelParams[String(fuel.id)] = Object.fromEntries(
        Object.entries({
          ...composition,
          TFe: composition?.TFe ?? 0,
          库存: fuel.inventory ?? 0,
          返焦率: composition?.['返焦率'] ?? 0,
          返焦价格: composition?.['返焦价格'] ?? 0,
          干基价格: composition?.['干基价格'] ?? 0,
        }).map(([k, v]) => [k, safeNumber(v)])
      );
      if (fuel.name) fuelIdNameMap[fuel.id] = fuel.name;
    });

    // 燃料限额
    const fuelLimits: Record<string, any> = {};
    Object.entries(config.fuelLimits || {}).forEach(([id, limit]: any) => {
      fuelLimits[id] = {
        low_limit: safeNumber(limit.low_limit),
        top_limit: safeNumber(limit.top_limit),
      };
    });

    // ---------------- 其他参数 ----------------
    const safeOtherSettings = Object.fromEntries(
      Object.entries(config.otherSettings || {}).map(([k, v]) => [k, typeof v === 'number' ? safeNumber(v) : String(v ?? '')])
    );

    // ---------------- 构建请求参数 ----------------
    const fullParams = {
      calculateType: moduleName,
      ingredientData,
      fuelData,
      ingredientParams,
      ingredientLimits,
      ingredientResults: config.ingredientResults || {},
      fuelParams,
      fuelLimits,
      fuelResults: config.fuelResults || {},
      slagLimits: Object.fromEntries(
        Object.entries(config.slagLimits || {}).map(([k, v]: any) => [
          k,
          { low_limit: safeNumber(v.low_limit), top_limit: safeNumber(v.top_limit) },
        ])
      ),
      hotMetalRatio: Object.fromEntries(
        Object.entries(config.hotMetalRatio || {}).map(([k, v]) => [k, safeNumber(v)])
      ),
      loadTopLimits: Object.fromEntries(
        Object.entries(config.loadTopLimits || {}).map(([k, v]) => [k, safeNumber(v)])
      ),
      ironWaterTopLimits: Object.fromEntries(
        Object.entries(config.ironWaterTopLimits || {}).map(([k, v]) => [k, safeNumber(v)])
      ),
      otherSettings: safeOtherSettings,
    };

    this.logger.debug('=== Full Params for FastAPI ===');
    this.logger.debug(JSON.stringify(fullParams, null, 2));

    // ---------------- 调用 FastAPI ----------------
    const res = await this.apiPost('gl-fixed/start', fullParams);
    const taskUuid = res.data?.data?.taskUuid;
    const resultsById = res.data?.data?.results;
    if (!taskUuid) throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');

    // ---------------- 保存任务 ----------------
    const task = this.taskRepo.create({
      task_uuid: taskUuid,
      module_type: moduleName,
      status: TaskStatus.RUNNING,
      parameters: fullParams,
      user
    });
    await this.taskRepo.save(task);

    // ---------------- 构建 ID → Name 映射 ----------------
    const idNameMap: Record<number, string> = { ...ingredientIdNameMap, ...fuelIdNameMap };

    const resultMap: Record<string, any> = {};
    if (resultsById) {
      Object.keys(resultsById).forEach(idStr => {
        const id = Number(idStr);
        const name = idNameMap[id];
        if (name) resultMap[name] = resultsById[id];
      });
    }

    return ApiResponse.success({ taskUuid, resultMap }, '任务启动成功');

  } catch (err: any) {
    return this.handleError(err, '启动任务失败');
  }
}

  // ============================
  // 查询进度
  // ============================
async getProgress(taskUuid: string): Promise<ApiResponse<any>> {
  try {
    // ---------------- 1️⃣ 查询任务 ----------------
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (!task) return ApiResponse.error('任务不存在');

    let results: any[] = [];

    // ---------------- 构建快照映射（分开原料和燃料） ----------------
    const params = task.parameters || {};
    const ingredientData = params.ingredientData || [];
    const fuelData = params.fuelData || [];

    const ingredientIdNameMap: Record<string, string> = {};
    ingredientData.forEach(item => {
      if (item.id != null && item.name) ingredientIdNameMap[String(item.id)] = item.name;
    });

    const fuelIdNameMap: Record<string, string> = {};
    fuelData.forEach(item => {
      if (item.id != null && item.name) fuelIdNameMap[String(item.id)] = item.name;
    });

    // ---------------- 2️⃣ 任务未完成 ----------------
    if (task.status !== TaskStatus.FINISHED) {
      const res: AxiosResponse = await this.apiPost('gl-fixed/progress', {}, { taskUuid });
      const data = res.data?.data;
      if (!data || !Array.isArray(data.results)) throw new Error('FastAPI 返回异常或 results 不是数组');

      // 更新任务状态和进度
      task.status = data.status === 'finished' ? TaskStatus.FINISHED : TaskStatus.RUNNING;
      task.progress = Number(data.progress ?? 0);
      task.total = Number(data.total ?? 0);
      await this.taskRepo.save(task);

      // 过滤出有成本的方案
      const validResults = data.results.filter(
        item => item && item["主要参数"] && typeof item["主要参数"].成本 === "number"
      );

      // ---------------- 映射原料和燃料名称 ----------------
      results = validResults.map(item => {
        const mapped: Record<string, any> = { ...item };

        // 原料
        if (item["原料配比和矿耗"]) {
          const newRaw: Record<string, any> = {};
          Object.entries(item["原料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
            if (val && val.矿耗 != null && val.配比 != null) {
              const idStr = String(id);
              newRaw[idStr] = { ...val, name: ingredientIdNameMap[idStr] || idStr };
            }
          });
          mapped["原料配比和矿耗"] = newRaw;
        }

        // 燃料
        if (item["燃料配比和矿耗"]) {
          const newFuel: Record<string, any> = {};
          Object.entries(item["燃料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
            if (val && val.矿耗 != null && val.配比 != null) {
              const idStr = String(id);
              newFuel[idStr] = { ...val, name: fuelIdNameMap[idStr] || idStr };
            }
          });
          mapped["燃料配比和矿耗"] = newFuel;
        }

        // 确保方案序号存在
        mapped.方案序号 = mapped.方案序号 ?? 1;
        return mapped;
      });

      // 任务完成 → 保存最终结果
      if (task.status === TaskStatus.FINISHED && results.length) {
        await this.saveResults(task, results);
      }

    } else {
      // ---------------- 任务已完成 → 从数据库读取 ----------------
      const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
      if (resultEntity?.output_data?.length) {
        results = resultEntity.output_data.map(r => ({
          ...r,
          方案序号: r['方案序号'] ?? 1
        }));
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
  // 保存结果到数据库
  // ============================
  private async saveResults(task: Task, results: any[]): Promise<void> {
    if (!results?.length) return;
    await this.resultRepo.save(this.resultRepo.create({
      task,
      output_data: results,
      is_shared: false,
      finished_at: new Date()
    }));
  }

  // ============================
  // 错误处理
  // ============================
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
    return ApiResponse.error(message);
  }

  // ============================
  // Axios 封装
  // ============================
  private async apiPost(path: string, data: any, params: any = {}): Promise<AxiosResponse<any>> {
    const url = `${this.fastApiUrl}/${path.replace(/^\/+/, '')}`;
    return axios.post(url, data, { params, headers: { 'Content-Type': 'application/json' } });
  }

  private async apiGet(path: string, params: any = {}): Promise<AxiosResponse<any>> {
    const url = `${this.fastApiUrl}/${path.replace(/^\/+/, '')}`;
    return axios.get(url, { params, headers: { 'Content-Type': 'application/json' } });
  }
}
