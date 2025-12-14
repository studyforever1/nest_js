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


/** 分页参数 DTO */
export interface PaginationDto {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** 内存缓存结构 */
interface TaskCache {
  results: any[];           // 增量结果缓存
  lastUpdated: number;      // 上次更新时间戳
}
/** 根据字段路径取值，比如 '主要参数.成本' 或 '化学成分.TFe' */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

@Injectable()
export class CalcService {
  private readonly logger = new Logger(CalcService.name);
  private readonly fastApiUrl = process.env.FASTAPI_URL;

  /** 内存缓存：taskUuid -> TaskCache */
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(SjRawMaterial) private readonly sjRawMaterialRepo: Repository<SjRawMaterial>,
    private readonly sjconfigService: SjconfigService,
  ) {}

  /** 启动计算任务 */
  /** 启动计算任务（支持 taskUuid 未及时返回 → 初始化中） */
async startTask(moduleName: string, user: User): Promise<ApiResponse<{ taskUuid?: string; resultMap: Record<string, any>; status: string }>> {
  try {
    this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

    // 获取最新配置
    const config = await this.sjconfigService.getLatestConfigByName(user, moduleName);
    if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

    // 获取原料参数
    const ingredientIds = config.ingredientParams || [];
    const raws = await this.sjRawMaterialRepo.find({ where: { id: In(ingredientIds), enabled: true } });

    const ingredientParams: Record<number, any> = {};
    raws.forEach(raw => {
      ingredientParams[raw.id] = {
        ...raw.composition,
        TFe: raw.composition?.TFe ?? 0,
        烧损: raw.composition?.['烧损'] ?? 0,
        价格: raw.composition?.['价格'] ?? 0,
        库存: raw.inventory ?? 0,
      };
    });

    // 清理原料上下限
    const ingredientLimitsClean: Record<string, any> = {};
    Object.keys(config.ingredientLimits || {}).forEach(id => {
      const { name, ...limits } = config.ingredientLimits[id];
      ingredientLimitsClean[id] = limits;
    });

    const fullParams = {
      calculateType: moduleName,
      ingredientParams,
      ingredientLimits: ingredientLimitsClean,
      chemicalLimits: config.chemicalLimits || {},
      otherSettings: config.otherSettings || {},
    };

    this.logger.debug('=== fullParams JSON ===');
    this.logger.debug(JSON.stringify(fullParams, null, 2));

    let taskUuid: string | undefined;
    let resultsById: Record<string, any> | undefined;

    try {
      // 调用 FastAPI 启动任务
      const res = await this.apiPost('/sj/start/', fullParams);
      taskUuid = res.data?.data?.taskUuid;
      resultsById = res.data?.data?.results;
    } catch (err) {
      // FastAPI 可能未及时返回 taskUuid → 初始化中
      this.logger.warn(`启动 FastAPI 任务未返回 taskUuid: ${(err as any)?.message || err}`);
    }

    // 保存 Task（仅当 taskUuid 可用）
    if (taskUuid) {
      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: moduleName,
        status: TaskStatus.RUNNING,
        parameters: fullParams,
        user,
      });
      await this.taskRepo.save(task);

      // 初始化内存缓存
      this.taskCache.set(taskUuid, { results: [], lastUpdated: Date.now() });
    }

    // ID → Name 映射
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

    return ApiResponse.success(
      {
        taskUuid,
        resultMap,
        status: taskUuid ? 'RUNNING' : 'INITIALIZING', // taskUuid 未返回 → 初始化中
      },
      taskUuid ? '任务启动成功 (ID → Name 映射)' : '任务初始化中'
    );

  } catch (err: unknown) {
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
        this.taskCache.delete(taskUuid);
        return ApiResponse.success({ taskUuid, status: 'stopped' }, '任务已停止');
      }
      return ApiResponse.error(res.data?.message || '停止失败');
    } catch (err: unknown) {
      return this.handleError(err, '停止任务失败');
    }
  }

  /** 查询任务进度（增量返回 + 分页排序 + 总页数） */
/** 查询任务进度（增量 + 分页排序 + 总页数 + 完成任务返回最终结果） */
/** 查询任务进度（增量 + 分页排序 + 总页数 + 完成任务返回最终结果） */
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
      const res = await this.apiGet('/sj/progress/', { taskUuid });
      const { code, message, data } = res.data;
      if (code !== 0 || !data) throw new Error(message || 'FastAPI 返回异常');

      // 收集所有原料代号
      const idSet = new Set<number>();
      for (const result of data.results || []) {
        const rawMix = result["原料配比"] || {};
        Object.keys(rawMix).forEach(idStr => idSet.add(Number(idStr)));
      }

      // 获取数据库原料信息
      const raws = await this.sjRawMaterialRepo.find({ where: { id: In([...idSet]) } });
      const idNameMap: Record<string, string> = {};
      raws.forEach(raw => idNameMap[String(raw.id)] = raw.name);

      // 原料上下限信息
      const ingredientLimits: Record<string, any> = task.parameters?.ingredientLimits || {};

      // 增量结果处理
      results = (data.results || []).map(item => {
        const mapped = { ...item };
        if (item["原料配比"]) {
          const newMix: Record<string, any> = {};
          Object.entries(item["原料配比"]).forEach(([code, val]) => {
            const valObj = val as Record<string, any>;
            const limits = ingredientLimits[code] || {};
            newMix[code] = {
              ...valObj,                         // 保留原有字段
              name: idNameMap[code] || limits.name || code, // 新增 name
              配比: (valObj.配比 ?? 0) * 100,
              };
          });
          mapped["原料配比"] = newMix;
        }
        // 化学成分保持原有结构
        mapped["化学成分"] = mapped["化学成分"] || {};
        return mapped;
      });

      // 更新内存缓存
      const cache = this.taskCache.get(taskUuid) || { results: [], lastUpdated: Date.now() };
      cache.results.push(...results);
      cache.lastUpdated = Date.now();
      this.taskCache.set(taskUuid, cache);

      // 更新任务状态
      task.status = this.mapStatus(data.status);
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


/** 分页 + 排序工具方法 */
private applyPaginationAndSort(results: any[], pagination?: PaginationDto) {
  let sortedResults = results;

  if (pagination?.sort) {
    const fieldPath = pagination.sort; // 支持 '主要参数.成本'、'化学成分.TFe'
    const order = pagination.order === 'desc' ? -1 : 1;

    sortedResults = [...results].sort((a, b) => {
      let va = getNestedValue(a, fieldPath);
      let vb = getNestedValue(b, fieldPath);

      // 转数字排序优先
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) {
        va = na;
        vb = nb;
      } else {
        va = va ? String(va) : '';
        vb = vb ? String(vb) : '';
      }

      return va > vb ? order : va < vb ? -order : 0;
    });
  }

  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  const pagedResults = sortedResults.slice(start, start + pageSize);

  return {
    pagedResults,
    totalResults: sortedResults.length,
    totalPages: Math.ceil(sortedResults.length / pageSize),
  };
}


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
  async getSchemeByIndex(taskUuid: string, index: number): Promise<any | null> {
  // 查找任务
  const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
  if (!task) return null;

  // 查询结果
  const resultEntity = await this.resultRepo.findOne({
    where: { task: { task_uuid: taskUuid } },
  });
  if (!resultEntity) return null;

  // 确保 output_data 是数组
  let allResults: any[] = [];
  if (Array.isArray(resultEntity.output_data)) {
    allResults = resultEntity.output_data;
  } else if (typeof resultEntity.output_data === 'string') {
    try {
      allResults = JSON.parse(resultEntity.output_data);
    } catch (err) {
      this.logger.error(`解析 output_data 出错: ${err}`);
      return null;
    }
  }

  // 检查 index 是否越界
  const scheme = allResults[index];
  if (!scheme) return null;

  // 原料上下限信息
  const ingredientLimits: Record<string, { low_limit?: number; top_limit?: number; name?: string }> =
    task.parameters?.ingredientLimits || {};

  // 化学成分上下限信息
  const chemicalLimits: Record<string, { low_limit?: number; top_limit?: number }> =
    task.parameters?.chemicalLimits || {};

  // 原料配比处理：保留代号 + 添加 name + 上下限 + 配比 x100
  const ingredientWithLimits: Record<string, any> = {};
  const rawIds = Object.keys(scheme['原料配比'] || {});
  
  // 从数据库获取原料名称映射
  const raws = await this.sjRawMaterialRepo.find({ where: { id: In(rawIds.map(Number)) } });
  const idNameMap: Record<string, string> = {};
  raws.forEach(raw => idNameMap[String(raw.id)] = raw.name);

  Object.entries(scheme['原料配比'] || {}).forEach(([code, val]) => {
    const valObj = val as Record<string, any>;
    const limits = ingredientLimits[code] || {};
    ingredientWithLimits[code] = {
      ...valObj,
      name: idNameMap[code] || limits.name || code,
      low_limit: limits.low_limit ?? null,
      top_limit: limits.top_limit ?? null // 小数转百分比
    };
  });

  // 化学成分处理：保留原有字段 + 上下限
  // 化学成分处理：保留原有值 + 上下限
const chemicalWithLimits: Record<string, any> = {};
Object.entries(scheme['化学成分'] || {}).forEach(([key, val]) => {
  const limits = chemicalLimits[key] || {};
  chemicalWithLimits[key] = {
    value: val, // 原来的数值
    low_limit: limits.low_limit ?? null,
    top_limit: limits.top_limit ?? null,
  };
});


  return {
    ...scheme,
    '原料配比': ingredientWithLimits,
    '化学成分': chemicalWithLimits,
  };
}


/** 导出单个方案为 Excel，并整理所需参数 */
async exportSchemeExcel(taskUuid: string, index: number) {
  // 1️⃣ 获取方案信息
  const scheme = await this.getSchemeByIndex(taskUuid, index);
  if (!scheme) throw new Error('方案不存在');

  const ingredientWithLimits = scheme['原料配比'] || {};
  const mainParams = scheme['主要参数'] || {};
  const chemical = scheme['化学成分'] || {};

  // 2️⃣ 获取任务参数（用于 其他费用）
  const task = await this.taskRepo.findOne({
    where: { task_uuid:taskUuid },
  });

  // 3️⃣ 获取原料 ID 列表
  const ingredientIds = Object.keys(ingredientWithLimits).map(Number);

  // 4️⃣ 查询原料基础信息
  const rawMaterials = await this.sjRawMaterialRepo.find({
    where: { id: In(ingredientIds) },
  });

  // 5️⃣ 组装 ingredientParams（FastAPI 需要的结构）
  const ingredientParams: Record<string, any> = {};

  for (const id of ingredientIds) {
    const val = ingredientWithLimits[id];
    const raw = rawMaterials.find(r => r.id === id);

    if (!raw) continue;

    ingredientParams[val.name] = {
      原料产地: raw.origin || '',
      分类编号: raw.category || '',
      H2O: raw.composition?.H2O ?? 0,
      价格: raw.composition?.价格 ?? 0,
      lose_index: val.lose_index ?? 1,
      配比: Number(val.配比) || 0,
    };
  }

  // 6️⃣ 组装 otherSettings（FastAPI 用）
  const finalOtherSettings = {
    ...scheme.otherSettings,
    ...mainParams,
    导出名称: `${taskUuid}-${index}`,
    其他费用: task?.parameters?.['otherSettings']["其他费用"] ?? 0,
    干基总残存: mainParams['干基总残存'] ?? 0,
    品位: chemical?.TFe?.value ?? 0,
  };
  console.log(ingredientParams,finalOtherSettings)
  return {
    ingredientParams,
    otherSettings: finalOtherSettings,
  };
}

/** 调用 FastAPI 生成 Excel */
async callFastApi(payload: { ingredientParams: any; otherSettings: any }) {
  const response = await axios.post(`${this.fastApiUrl}${'/sj/export/excel/'}`, payload, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

  /** 调用 FastAPI 生成 Excel buffer */
}
