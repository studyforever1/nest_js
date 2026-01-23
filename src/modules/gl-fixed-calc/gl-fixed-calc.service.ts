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

      const config = await this.glconfigService.getLatestIngredients(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

      // ---------------- 原料处理 ----------------
      const ingredientIds = config.ingredientParams || [];
      const raws = await this.glRawMaterialRepo.find({ where: { id: In(ingredientIds), enabled: true } });

      const ingredientParams: Record<string, any> = {};
      raws.forEach(raw => {
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
      });

      const ingredientLimits: Record<string, any> = {};
      Object.keys(config.ingredientLimits || {}).forEach(id => {
        const limit = config.ingredientLimits[id];
        if (!limit) return;
        ingredientLimits[id] = {
          low_limit: safeNumber(limit.low_limit),
          top_limit: safeNumber(limit.top_limit),
        };
      });

      // ---------------- 燃料处理 ----------------
      const fuelIds: number[] = config.fuelParams || [];
      const fuels = fuelIds.length
        ? await this.glFuelRepo.find({ where: { id: In(fuelIds), enabled: true } })
        : [];

      const fuelParams: Record<string, any> = {};
      fuels.forEach(fuel => {
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
      });

      const fuelLimits: Record<string, any> = {};
      fuelIds.forEach(id => {
        const limit = config.fuelLimits?.[id];
        if (limit) {
          fuelLimits[String(id)] = {
            low_limit: safeNumber(limit.low_limit),
            top_limit: safeNumber(limit.top_limit),
          };
        }
      });

      // ---------------- 其他参数处理 ----------------
      const safeOtherSettings = Object.fromEntries(
        Object.entries(config.otherSettings || {}).map(([k, v]) => [k, typeof v === 'number' ? safeNumber(v) : String(v ?? '')])
      );

      const fullParams = {
        calculateType: moduleName,
        ingredientParams,
        ingredientLimits,
        ingredientResults: config.ingredientResults || {},
        fuelResults: config.fuelResults || {},
        fuelParams,
        fuelLimits,
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

      // 保存 Task
      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: moduleName,
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user
      });
      await this.taskRepo.save(task);

      // 构建 ID → Name 映射
      const idNameMap: Record<number, string> = {};
      raws.forEach(r => idNameMap[r.id] = r.name);
      fuels.forEach(f => idNameMap[f.id] = f.name);

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
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (!task) return ApiResponse.error('任务不存在');

    let results: any[] = [];

    if (task.status !== TaskStatus.FINISHED) {
      // 调用 FastAPI 查询进度
      const res: AxiosResponse = await this.apiPost(
        'gl-fixed/progress',
        {},
        { taskUuid }
      );

      const data = res.data?.data;
      const fastApiResults = data?.results || [];

      // 更新任务状态和进度
      task.status = data?.status === 'finished' ? TaskStatus.FINISHED : TaskStatus.RUNNING;
      task.progress = Number(data?.progress ?? 0);
      await this.taskRepo.save(task);

      if (fastApiResults.length) {
        const rawResult = { ...fastApiResults[0] };

        // 收集原料和燃料ID
        const rawIds = Object.keys(rawResult['原料配比和矿耗'] || {}).map(id => Number(id));
        const fuelIds = Object.keys(rawResult['燃料配比和矿耗'] || {}).map(id => Number(id));

        // 查询数据库获取名称
        const raws = rawIds.length ? await this.glRawMaterialRepo.findBy({ id: In(rawIds) }) : [];
        const fuels = fuelIds.length ? await this.glFuelRepo.findBy({ id: In(fuelIds) }) : [];

        const idToName: Record<string, string> = {};
        raws.forEach(r => idToName[r.id.toString()] = r.name || r.id.toString());
        fuels.forEach(f => idToName[f.id.toString()] = f.name || f.id.toString());

        // 原料配比和矿耗加 name
        if (rawResult['原料配比和矿耗']) {
          const finalRaw: Record<string, any> = {};
          Object.entries(rawResult['原料配比和矿耗']).forEach(([id, val]: [string, any]) => {
            finalRaw[id] = { ...val, name: idToName[id] || id };
          });
          rawResult['原料配比和矿耗'] = finalRaw;
        }

        // 燃料配比和矿耗加 name
        if (rawResult['燃料配比和矿耗']) {
          const finalFuel: Record<string, any> = {};
          Object.entries(rawResult['燃料配比和矿耗']).forEach(([id, val]: [string, any]) => {
            finalFuel[id] = { ...val, name: idToName[id] || id };
          });
          rawResult['燃料配比和矿耗'] = finalFuel;
        }

        results.push({
          ...rawResult,
          方案序号: rawResult['方案序号'] ?? 1
        });

        // 如果任务完成，保存最终结果
        if (task.status === TaskStatus.FINISHED) {
          await this.saveResults(task, results);
        }
      }
    } else {
      // 任务已完成，从数据库读取
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
