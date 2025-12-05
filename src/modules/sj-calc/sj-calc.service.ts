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
import { ExportSchemeDto } from './dto/export-scheme.dto';
import ExcelJS from 'exceljs';


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
  async startTask(moduleName: string, user: User): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      const config = await this.sjconfigService.getLatestConfigByName(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

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

      const res = await this.apiPost('/sj/start/', fullParams);
      const taskUuid = res.data?.data?.taskUuid;
      const resultsById = res.data?.data?.results;

      if (!taskUuid) throw new Error(res.data?.message || 'FastAPI 未返回 taskUuid');

      // 保存 Task
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
/** 导出选中方案为 Excel */
async exportSchemeExcel(dto: ExportSchemeDto): Promise<Buffer> {
  const { taskUuid, schemeIndexes } = dto;

  const task = await this.findTask(taskUuid, ['user']);
  if (!task) throw new Error('任务不存在');
  if (task.status !== TaskStatus.FINISHED) throw new Error('任务尚未完成，无法导出方案');

  const resultEntity = await this.resultRepo.findOne({
    where: { task: { task_uuid: taskUuid } },
  });
  if (!resultEntity) throw new Error('未找到任务结果');

  const allResults = resultEntity.output_data || [];
  const schemes = schemeIndexes.map(i => ({ index: i, data: allResults[i] })).filter(x => x.data);
  if (!schemes.length) throw new Error('没有可导出的方案');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('方案导出');

  // 自动生成列，嵌套对象用 JSON.stringify 展示
  const example = schemes[0].data;
  const columns = Object.keys(example).map(key => ({
    header: key,
    key: key,
    width: 20,
  }));

  sheet.columns = [
    { header: '方案序号', key: 'index', width: 15 },
    ...columns,
  ];

  // 填充数据
  schemes.forEach(item => {
    const rowData: Record<string, any> = { index: item.index };
    for (const [key, value] of Object.entries(item.data)) {
      rowData[key] = typeof value === 'object' ? JSON.stringify(value) : value;
    }
    sheet.addRow(rowData);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
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

}
