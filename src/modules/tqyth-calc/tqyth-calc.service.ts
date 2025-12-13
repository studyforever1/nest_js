import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { Result } from '../../database/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { GlMaterialInfo } from '../gl-material-info/entities/gl-material-info.entity'; // 原料表，可复用
import { GlConfigService } from '../gl-config/gl-config.service'; // 可复用配置服务
import { GlFuelInfo } from '../gl-fuel-info/entities/gl-fuel-info.entity'; // 燃料表，可复用
import { SjCandidate } from '../sj-candidate/entities/sj-candidate.entity';

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
export class TqythCalcService {
  private readonly logger = new Logger(TqythCalcService.name);
  private readonly fastApiUrl = process.env.FASTAPI_URL;
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo) private readonly glMaterialRepo: Repository<GlMaterialInfo>,
    @InjectRepository(GlFuelInfo) private readonly glFuelRepo: Repository<GlFuelInfo>,  // ✅ 新增燃料表
    @InjectRepository(SjCandidate)private readonly sjCandidateRepo: Repository<SjCandidate>,
    private readonly glConfigService: GlConfigService, // 可复用
  ) {}

  /** 启动铁前一体化配料计算I 任务，支持 SJPlan */
async startTask(
  moduleName: string,
  user: User
): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
  try {
    this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

    const config = await this.glConfigService.getLatestIngredients(user, moduleName);
    if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

    const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

    // ---------------- 原料处理 ----------------
    const ingredientIds = config.ingredientParams || [];
    const raws = await this.glMaterialRepo.find({ where: { id: In(ingredientIds), enabled: true } });

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
    const fuelIds: number[] = config.fuelParams || [];
    const fuels = fuelIds.length ? await this.glFuelRepo.find({ where: { id: In(fuelIds), enabled: true } }) : [];

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
      const fuel = fuels.find(f => f.id === id);
      if (fuel && limit) {
        fuelLimits[String(id)] = {
          low_limit: safeNumber(limit.low_limit),
          top_limit: safeNumber(limit.top_limit),
        };
      }
    });
    // ---------------- 整理 SJPlan ----------------
const candidates = await this.sjCandidateRepo.find({
  where: { 
    user: { user_id: user.user_id },
    module_type: '烧结配料计算',
  },
  relations: ['task', 'user'],
});

const sjPlan: Record<string, any> = {};

candidates.forEach(candidate => {
  const resultData = candidate.result;
  if (!resultData || !resultData['化学成分']) return;

  // ✅ 使用 sj_candidate 表中的唯一主键 id
  const planId = candidate.id.toString();

  sjPlan[planId] = {
    ...resultData['化学成分'],
    ...(resultData['主要参数']?.成本 != null
      ? { 成本: resultData['主要参数'].成本 }
      : {}),
  };
});

    // ---------------- 其他参数 ----------------
    const safeOtherSettings = {
  ...config.otherSettings,
  固定配比: Array.isArray(config.otherSettings?.["固定配比"]) ? config.otherSettings["固定配比"] : [],
  块矿: Array.isArray(config.otherSettings?.["块矿"]) ? config.otherSettings["块矿"] : [],
};


    const fullParams = {
      calculateType: moduleName,
      SJPlan: sjPlan, 
      ingredientParams,
      ingredientLimits,
      fuelParams,
      fuelLimits,
      slagLimits: Object.fromEntries(
        Object.entries(config.slagLimits || {}).map(([k, v]: any) => [k, { low_limit: safeNumber(v.low_limit), top_limit: safeNumber(v.top_limit) }])
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

    const res = await this.apiPost('/tqyth/start/', fullParams);
    const taskUuid = res.data?.data?.taskUuid;
    const resultsById = res.data?.data?.results;

    if (!taskUuid) throw new Error(res.data?.message || "FastAPI 未返回 taskUuid");

    const task = this.taskRepo.create({
      task_uuid: taskUuid,
      module_type: moduleName,
      status: TaskStatus.RUNNING,
      parameters: fullParams,
      user
    });
    await this.taskRepo.save(task);
    this.taskCache.set(taskUuid, { results: [], lastUpdated: Date.now() });

    // 映射 ID → Name
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

  /** 停止任务 */
  /** 停止任务（并保存已计算结果） */
async stopTask(
  taskUuid: string,
): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
  try {
    const task = await this.findTask(taskUuid);
    if (!task) return ApiResponse.error('任务不存在');

    // 1️⃣ 调用 FastAPI 停止任务
    const res = await this.apiPost('/tqyth/stop/', { taskUuid });

    if (res.data?.status !== 'stopped' && res.status !== 200) {
      return ApiResponse.error(res.data?.message || '停止失败');
    }

    // 2️⃣ 尝试保存当前已计算结果
    const cache = this.taskCache.get(taskUuid);
    if (cache?.results?.length) {
      await this.saveResults(task, cache.results);
    }

    // 3️⃣ 更新任务状态
    task.status = TaskStatus.STOPPED;
    await this.taskRepo.save(task);

    // 4️⃣ 清理缓存
    this.taskCache.delete(taskUuid);

    return ApiResponse.success(
      { taskUuid, status: 'stopped' },
      '任务已停止，已保存当前计算结果',
    );
  } catch (err: unknown) {
    return this.handleError(err, '停止任务失败');
  }
}


  /** 查询任务进度 */
  async fetchAndSaveProgress(taskUuid: string, pagination?: PaginationDto): Promise<ApiResponse<any>> {
  try {
    const task = await this.findTask(taskUuid);
    if (!task) return ApiResponse.success({
      taskUuid, status: 'initializing', progress: 0, total: 0,
      results: [], page: pagination?.page ?? 1, pageSize: pagination?.pageSize ?? 10,
      totalResults: 0, totalPages: 0
    }, '任务初始化中');

    let results: any[] = [];

    if (task.status !== TaskStatus.FINISHED) {
      const res = await this.apiGet('/tqyth/progress/', { taskUuid });
      const { code, message, data } = res.data;
      if (code !== 0 || !data) throw new Error(message || 'FastAPI 返回异常');

      // 过滤空结果
      const incoming = (data.results || []).filter(r => r && typeof r === 'object' && Object.keys(r).length > 0);

      // 收集所有原料和燃料 id
      const idSet = new Set<number>();
      for (const item of incoming) {
        const rawMix = item["原料配比和矿耗"] || {};
        Object.keys(rawMix).forEach(idStr => idSet.add(Number(idStr)));

        const fuelMix = item["燃料配比和矿耗"] || {};
        Object.keys(fuelMix).forEach(idStr => idSet.add(Number(idStr)));
      }

      // 查询数据库
      const raws = await this.glMaterialRepo.find({ where: { id: In([...idSet]) } });
      const fuels = await this.glFuelRepo.find({ where: { id: In([...idSet]) } });

      const idNameMap: Record<string, string> = {};
      raws.forEach(r => idNameMap[String(r.id)] = r.name);
      fuels.forEach(f => idNameMap[String(f.id)] = f.name);

      // 给原料和燃料加 name
      const mappedIncoming = incoming.map(item => {
        const mapped = { ...item };

        if (item["原料配比和矿耗"]) {
          const newRaw: Record<string, any> = {};
          Object.entries(item["原料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
            if (val && val.矿耗 != null && val.配比 != null) {
              newRaw[id] = { ...val, name: idNameMap[id] || id };
            }
          });
          mapped["原料配比和矿耗"] = newRaw;
        }

        if (item["燃料配比和矿耗"]) {
          const newFuel: Record<string, any> = {};
          Object.entries(item["燃料配比和矿耗"]).forEach(([id, val]: [string, any]) => {
            if (val && val.矿耗 != null && val.配比 != null) {
              newFuel[id] = { ...val, name: idNameMap[id] || id };
            }
          });
          mapped["燃料配比和矿耗"] = newFuel;
        }

        return mapped;
      });

      // 更新缓存
      const cache = this.taskCache.get(taskUuid) || { results: [], lastUpdated: Date.now() };
      cache.results.push(...mappedIncoming);
      cache.lastUpdated = Date.now();
      this.taskCache.set(taskUuid, cache);

      // 更新任务状态
      task.status = data.status === 'finished' ? TaskStatus.FINISHED : TaskStatus.RUNNING;
      task.progress = data.progress;
      task.total = data.total;
      await this.taskRepo.save(task);

      // 任务完成，持久化结果
      if (task.status === TaskStatus.FINISHED && cache.results.length) {
        await this.saveResults(task, cache.results);
        this.taskCache.delete(taskUuid);
      }

      results = cache.results;
    } else {
      const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
      results = resultEntity?.output_data || [];
    }

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

async getSchemeByIndex(taskUuid: string, schemeIndex: number): Promise<ApiResponse<any>> {
  const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
  if (!task) return ApiResponse.error('任务不存在', 404);

  const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
  if (!resultEntity) return ApiResponse.error('结果不存在', 404);

  let allResults: any[] = [];
  if (Array.isArray(resultEntity.output_data)) allResults = resultEntity.output_data;
  else if (typeof resultEntity.output_data === 'string') {
    try {
      allResults = JSON.parse(resultEntity.output_data);
    } catch (err) {
      this.logger.error(`解析 output_data 出错: ${err}`);
      return ApiResponse.error('结果解析错误');
    }
  }

  const scheme = allResults.find(item => item['方案序号'] === schemeIndex);
  if (!scheme) return ApiResponse.error('方案不存在', 404);

  const { ingredientLimits = {}, fuelLimits = {}, slagLimits = {}, ironWaterTopLimits = {}, loadTopLimits = {} } = task.parameters || {};

  // 原料/燃料处理
  const processMaterials = async (field: string, limitsMap: Record<string, any>) => {
    const data: Record<string, any> = scheme[field] || {};
    const ids = Object.keys(data).map(Number);

    // 查询原料和燃料名字
    const raws = await this.glMaterialRepo.find({ where: { id: In(ids) } });
    const fuels = await this.glFuelRepo.find({ where: { id: In(ids) } });

    const idNameMap: Record<string, string> = {};
    raws.forEach(r => idNameMap[String(r.id)] = r.name);
    fuels.forEach(f => idNameMap[String(f.id)] = f.name);

    const result: Record<string, any> = {};
    Object.entries(data).forEach(([id, val]) => {
      const limits = limitsMap[id] || {};
      result[id] = {
        ...val,
        name: val.name || idNameMap[id] || id,
        low_limit: limits.low_limit ?? 0,
        top_limit: limits.top_limit ?? 100
      };
    });
    return result;
  };

  // 负荷/炉渣/铁水处理
  const processValuesWithLimits = (data: Record<string, any>, limitsMap: Record<string, any>, lowDefault = 0, topDefault = 100) => {
    const result: Record<string, any> = {};
    Object.entries(data || {}).forEach(([key, val]) => {
      const limits = limitsMap[key] || {};
      result[key] = {
        value: val,
        low_limit: limits.low_limit ?? lowDefault,
        top_limit: limits.top_limit ?? (limits.top_limit ?? topDefault)
      };
    });
    return result;
  };

  const rawMaterials = await processMaterials('原料配比和矿耗', ingredientLimits);
  const fuelMaterials = await processMaterials('燃料配比和矿耗', fuelLimits);
  const load = processValuesWithLimits(scheme['负荷'], loadTopLimits);
  const slag = processValuesWithLimits(scheme['炉渣成分'], slagLimits);
  const ironWater = processValuesWithLimits(scheme['铁水含量'], ironWaterTopLimits);

  // 返回统一 ApiResponse
  return ApiResponse.success({
    '原料配比和矿耗': rawMaterials,
    '燃料配比和矿耗': fuelMaterials,
    '负荷': load,
    '炉渣成分': slag,
    '铁水含量': ironWater,
    '主要参数': scheme['主要参数'],
    '方案序号': scheme['方案序号']
  }, '获取成功');
}


  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> { return axios.post(`${this.fastApiUrl}${path}`, data); }
  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> { return axios.get(`${this.fastApiUrl}${path}`, { params }); }
  private async findTask(taskUuid: string): Promise<Task | null> { return this.taskRepo.findOne({ where: { task_uuid: taskUuid } }); }
  private async saveResults(task: Task, results: any[]): Promise<void> { await this.resultRepo.save(this.resultRepo.create({ task, output_data: results, is_shared: false, finished_at: new Date() })); }
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> { const message = err instanceof Error ? err.message : String(err); this.logger.error(`${prefix}: ${message}`); return ApiResponse.error(message); }
}
