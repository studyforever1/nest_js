import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity';
import { GlConfigService } from '../gl-config/gl-config.service' // 可共用配置服务
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity';

export interface PaginationDto {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

interface TaskCache {
  results: any[];
  lastUpdated: number;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

@Injectable()
export class GlCalcService {
  private readonly logger = new Logger(GlCalcService.name);
  private readonly fastApiUrl = process.env.FASTAPI_URL;
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo) private readonly glRawMaterialRepo: Repository<GlMaterialInfo>,
    @InjectRepository(GlFuelInfo) private readonly glFuelRepo: Repository<GlFuelInfo>,  // ✅ 新增燃料表
    private readonly glconfigService: GlConfigService,
  ) { }


  /** 启动高炉配料计算任务 */
  async startTask(
    moduleName: string,
    user: User
  ): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      // 1️⃣ 获取最新配置
      const config = await this.glconfigService.getLatestIngredients(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

      // ---------------- 原料处理 ----------------
      const ingredientIds = config.ingredientParams || [];
      const raws = await this.glRawMaterialRepo.find({
        where: { id: In(ingredientIds), enabled: true },
      });

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

      // ---------------- 原料限制 ----------------
      const ingredientLimits: Record<string, any> = {};
      Object.keys(config.ingredientLimits || {}).forEach(id => {
        const limit = config.ingredientLimits[id];
        const raw = raws.find(r => r.id === Number(id));
        if (!raw) return;
        ingredientLimits[id] = {
          low_limit: safeNumber(limit.low_limit),
          top_limit: safeNumber(limit.top_limit),
        };
      });

      // ---------------- 燃料处理 ----------------
      // ---------------- 燃料处理 ----------------
      const fuelIds: number[] = config.fuelParams || []; // 直接用数组
      const fuels = fuelIds.length
        ? await this.glFuelRepo.find({ where: { id: In(fuelIds), enabled: true } })
        : [];

      const fuelParams: Record<string, any> = {};
      fuels.forEach(fuel => {
        const composition =
          typeof fuel.composition === 'string' ? JSON.parse(fuel.composition) : fuel.composition || {};
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
        const fuel = fuels.find(f => f.id === id);
        if (fuel && limit) {
          fuelLimits[String(id)] = {
            low_limit: safeNumber(limit.low_limit),
            top_limit: safeNumber(limit.top_limit),
          };
        }
      });

      // ---------------- 其他参数处理 ----------------
      const safeOtherSettings = {
        "其他费用": safeNumber(config.otherSettings?.["其他费用"]),
        "品位上限": safeNumber(config.otherSettings?.["品位上限"]),
        "品位下限": safeNumber(config.otherSettings?.["品位下限"]),
        "品位间距": safeNumber(config.otherSettings?.["品位间距"]),
        "固定配比": Array.isArray(config.otherSettings?.["固定配比"]) ? config.otherSettings["固定配比"] : [],
        "块矿": Array.isArray(config.otherSettings?.["块矿"]) ? config.otherSettings["块矿"] : [],
        "块矿总比例上限": safeNumber(config.otherSettings?.["块矿总比例上限"]),
        "块矿总比例下限": safeNumber(config.otherSettings?.["块矿总比例下限"]),
        "焦丁折算系数": safeNumber(config.otherSettings?.["焦丁折算系数"]),
        "焦丁比": safeNumber(config.otherSettings?.["焦丁比"]),
        "焦比": safeNumber(config.otherSettings?.["焦比"]),
        "煤比": safeNumber(config.otherSettings?.["煤比"]),
        "煤比折算系数": safeNumber(config.otherSettings?.["煤比折算系数"]),
        "铁水产量": safeNumber(config.otherSettings?.["铁水产量"]),
        "铁水含铁量": safeNumber(config.otherSettings?.["铁水含铁量"]),
        "铁水回收率": safeNumber(config.otherSettings?.["铁水回收率"]),
        "高炉余量设置": safeNumber(config.otherSettings?.["高炉余量设置"]),
        "焦丁比选择": String(config.otherSettings?.["焦丁比选择"] ?? ''),
        "煤比选择": String(config.otherSettings?.["煤比选择"] ?? '')

      };

      const fullParams = {
        calculateType: moduleName,
        ingredientParams,
        ingredientLimits,
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
      const res = await this.apiPost("/gl/start/", fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      const resultsById = res.data?.data?.results;

      if (!taskUuid) throw new Error(res.data?.message || "FastAPI 未返回 taskUuid");

      // 保存 Task
      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: moduleName,
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user
      });
      await this.taskRepo.save(task);

      // 初始化缓存
      this.taskCache.set(taskUuid, { results: [], lastUpdated: Date.now() });

      // ID → Name 映射
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

      return ApiResponse.success({ taskUuid, resultMap }, "任务启动成功");

    } catch (err: any) {
      return this.handleError(err, "启动任务失败");
    }
  }


  async stopTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      const res = await this.apiPost('/gl/stop/', { taskUuid });
      if (res.data?.status === 'stopped' || res.status === 200) {
        task.status = TaskStatus.STOPPED;
        await this.taskRepo.save(task);
        this.taskCache.delete(taskUuid);
        return ApiResponse.success({ taskUuid, status: 'stopped' }, '任务已停止');
      }
      return ApiResponse.error(res.data?.message || '停止失败');
    } catch (err: unknown) {
      return this.handleError(err, '停止任务失败');
    }
  }

async fetchAndSaveProgress(taskUuid: string, pagination?: PaginationDto): Promise<ApiResponse<any>> {
  try {
    const task = await this.findTask(taskUuid);
    if (!task) {
      return ApiResponse.success({
        taskUuid,
        status: 'initializing',
        progress: 0,
        total: 0,
        results: [],
        page: pagination?.page ?? 1,
        pageSize: pagination?.pageSize ?? 10,
        totalResults: 0,
        totalPages: 0,
      }, '任务初始化中');
    }

    let results: any[] = [];

    if (task.status !== TaskStatus.FINISHED) {
      // 调用 FastAPI 获取增量结果
      const res = await this.apiGet('/gl/progress/', { taskUuid });
      const { code, message, data } = res.data;
      if (code !== 0 || !data) throw new Error(message || 'FastAPI 返回异常');

      // 收集所有原料和燃料代号
      const idSet = new Set<number>();
      for (const result of data.results || []) {
        const rawMix = result["原料配比和矿耗"] || {};
        Object.keys(rawMix).forEach(idStr => idSet.add(Number(idStr)));

        const fuelMix = result["燃料配比和矿耗"] || {};
        Object.keys(fuelMix).forEach(idStr => idSet.add(Number(idStr)));
      }

      // 获取数据库原料和燃料信息
      const raws = await this.glRawMaterialRepo.find({ where: { id: In([...idSet]) } });
      const fuels = await this.glFuelRepo.find({ where: { id: In([...idSet]) } });

      // 统一 id → name 映射
      const idNameMap: Record<string, string> = {};
      raws.forEach(r => idNameMap[String(r.id)] = r.name);
      fuels.forEach(f => idNameMap[String(f.id)] = f.name);

      // 过滤空 {} 并处理原料/燃料配比和矿耗
      results = (data.results || [])
        .filter(item => Object.keys(item).length > 0)
        .map(item => {
          const mapped = { ...item };

          // 原料配比和矿耗
          if (item["原料配比和矿耗"]) {
            const newRaw: Record<string, any> = {};
            Object.entries(item["原料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
              if (val && val.矿耗 != null && val.配比 != null) {
                newRaw[id] = {
                  ...val,
                  name: idNameMap[id] || id,
                };
              }
            });
            mapped["原料配比和矿耗"] = newRaw;
          }

          // 燃料配比和矿耗
          if (item["燃料配比和矿耗"]) {
            const newFuel: Record<string, any> = {};
            Object.entries(item["燃料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
              if (val && val.矿耗 != null && val.配比 != null) {
                newFuel[id] = {
                  ...val,
                  name: idNameMap[id] || id,
                };
              }
            });
            mapped["燃料配比和矿耗"] = newFuel;
          }

          return mapped;
        });

      // 更新缓存
      const cache = this.taskCache.get(taskUuid) || { results: [], lastUpdated: Date.now() };
      cache.results.push(...results);
      cache.lastUpdated = Date.now();
      this.taskCache.set(taskUuid, cache);

      // 更新任务状态
      task.status = data.status === 'finished' ? TaskStatus.FINISHED : TaskStatus.RUNNING;
      task.progress = data.progress;
      task.total = data.total;
      await this.taskRepo.save(task);

      results = cache.results;

      // 如果任务完成，持久化最终结果并清理缓存
      if (task.status === TaskStatus.FINISHED && results.length) {
        await this.saveResults(task, results);
        this.taskCache.delete(taskUuid);
      }
    } else {
      // 任务已完成，从数据库获取最终结果
      const resultEntity = await this.resultRepo.findOne({
        where: { task: { task_uuid: taskUuid } },
      });
      results = resultEntity?.output_data || [];
    }

    // 分页 + 排序
    const { pagedResults, totalResults, totalPages } = this.applyPaginationAndSort(results, pagination);

    return ApiResponse.success({
      taskUuid: task.task_uuid,
      status: task.status,
      progress: task.progress,
      total: task.total,
      results: pagedResults,
      page: pagination?.page ?? 1,
      pageSize: pagination?.pageSize ?? 10,
      totalResults,
      totalPages,
    });

  } catch (err: any) {
    return this.handleError(err, '获取任务进度失败');
  }
}


  private applyPaginationAndSort(results: any[], pagination?: PaginationDto) {
    let sortedResults = results;
    if (pagination?.sort) {
      const fieldPath = pagination.sort;
      const order = pagination.order === 'desc' ? -1 : 1;
      sortedResults = [...results].sort((a, b) => {
        let va = getNestedValue(a, fieldPath);
        let vb = getNestedValue(b, fieldPath);
        const na = Number(va), nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) { va = na; vb = nb; } else { va = va ? String(va) : ''; vb = vb ? String(vb) : ''; }
        return va > vb ? order : va < vb ? -order : 0;
      });
    }

    const page = pagination?.page ?? 1, pageSize = pagination?.pageSize ?? 10;
    const start = (page - 1) * pageSize;
    return { pagedResults: sortedResults.slice(start, start + pageSize), totalResults: sortedResults.length, totalPages: Math.ceil(sortedResults.length / pageSize) };
  }

  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> { return axios.post(`${this.fastApiUrl}${path}`, data); }
  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> { return axios.get(`${this.fastApiUrl}${path}`, { params }); }
  private async findTask(taskUuid: string): Promise<Task | null> { return this.taskRepo.findOne({ where: { task_uuid: taskUuid } }); }
  private async saveResults(task: Task, results: any[]): Promise<void> { await this.resultRepo.save(this.resultRepo.create({ task, output_data: results, is_shared: false, finished_at: new Date() })); }
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> { const message = err instanceof Error ? err.message : String(err); this.logger.error(`${prefix}: ${message}`); return ApiResponse.error(message); }
}
