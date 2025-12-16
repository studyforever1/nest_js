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
import ExcelJS from 'exceljs';
import { GLExportSchemeDto } from './dto/export-scheme.dto';

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

  async getSchemeByIndex(taskUuid: string, schemeIndex: number): Promise<ApiResponse<any>> {
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (!task) return ApiResponse.error('任务不存在', 404);

    const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
    if (!resultEntity) return ApiResponse.error('结果不存在', 404);

    let allResults: any[] = [];
    if (Array.isArray(resultEntity.output_data)) allResults = resultEntity.output_data;
    else if (typeof resultEntity.output_data === 'string') {
      try { allResults = JSON.parse(resultEntity.output_data); }
      catch (err) { this.logger.error(`解析 output_data 出错: ${err}`); return ApiResponse.error('结果解析错误'); }
    }

    const scheme = allResults.find(item => item['方案序号'] === schemeIndex);
    if (!scheme) return ApiResponse.error('方案不存在', 404);

    const { ingredientLimits = {}, fuelLimits = {}, slagLimits = {}, ironWaterTopLimits = {}, loadTopLimits = {} } = task.parameters || {};

    // 原料/燃料处理
    const processMaterials = async (field: string, limitsMap: Record<string, any>) => {
      const data: Record<string, any> = scheme[field] || {};
      const ids = Object.keys(data);

      const raws = await this.glRawMaterialRepo.find({ where: { id: In(ids.map(Number)) } });
      const fuels = await this.glFuelRepo.find({ where: { id: In(ids.map(Number)) } });

      const idNameMap: Record<string, string> = {};
      raws.forEach(r => idNameMap[String(r.id)] = r.name);
      fuels.forEach(f => idNameMap[String(f.id)] = f.name);

      const result: Record<string, any> = {};
      Object.entries(data).forEach(([id, val]) => {
        const limits = limitsMap[String(id)] || {};
        result[id] = {
          ...val,
          name: val.name || idNameMap[String(id)] || id,
          low_limit: limits.low_limit ?? 0,
          top_limit: limits.top_limit ?? 100
        };
      });
      return result;
    };

    // 负荷/铁水/炉渣处理
    const processValuesWithLimits = (data: Record<string, any>, limitsMap: Record<string, any>, lowDefault = 0) => {
      const result: Record<string, any> = {};
      Object.entries(data || {}).forEach(([key, val]) => {
        let low_limit = lowDefault;
        let top_limit = 100;

        if (limitsMap[key] != null && typeof limitsMap[key] === 'object') {
          // slagLimits 包含 low_limit/top_limit
          low_limit = limitsMap[key].low_limit ?? lowDefault;
          top_limit = limitsMap[key].top_limit ?? 100;
        } else if (limitsMap[key] != null && typeof limitsMap[key] === 'number') {
          // loadTopLimits / ironWaterTopLimits 只存上限
          top_limit = limitsMap[key];
        }

        result[key] = { value: val, low_limit, top_limit };
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



  /** 导出单个高炉方案为 Excel，并整理所需参数 */
  async exportSchemeExcel(taskUuid: string, index: number) {
    // 1️⃣ 获取方案
    const scheme = await this.getSchemeByIndex(taskUuid, index);
    if (!scheme?.data) throw new Error('方案不存在');

    const data = scheme.data;

    const ingredient = data['原料配比和矿耗'] || {};
    const mainParams = data['主要参数'] || {};
    const fuel = data['燃料配比和矿耗'] || {};
    // 2️⃣ 获取任务（为了 otherSettings）
    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid },
    });

    // 3️⃣ 原料 ID
    const ingredientIds = Object.keys(ingredient).map(Number);

    // 4️⃣ 查询高炉原料基础信息
    const rawMaterials = await this.glRawMaterialRepo.find({
      where: { id: In(ingredientIds) },
    });

    const fuelIds = Object.keys(fuel).map(Number);

    // 4️⃣ 查询高炉原料基础信息
    const fuelMaterials = await this.glFuelRepo.find({
      where: { id: In(fuelIds) },
    });


    // 5️⃣ 组装 ingredientParams（给 FastAPI）
    const ingredientParams: Record<string, any> = {};
    const fuelParams: Record<string, any> = {};
    for (const id of ingredientIds) {
      const val = ingredient[id];
      const raw = rawMaterials.find(r => r.id === id);
      if (!raw) continue;

      ingredientParams[val.name] = {
        返矿率: raw.composition?.返矿率 ?? 0,
        返矿价格: raw.composition?.返矿价格 ?? 0,
        干基价格: raw.composition?.干基价格 ?? 0,
        分类编号: raw.category || '',
        矿耗: Number(val.矿耗) || 0,
        配比: Number(val.配比) || 0,
      };
    }
    const coalRatioId = Number(task?.parameters?.['otherSettings']?.['煤比选择']);
    const cokeRatioId = Number(task?.parameters?.['otherSettings']?.['焦丁比选择']);
    for (const id of fuelIds) {
      const val = fuel[id];
      const raw = fuelMaterials.find(r => r.id === id);
      if (!raw) continue;

      const baseParams = {
        返焦率: raw.composition?.返焦率 ?? 0,
        返焦价格: raw.composition?.返焦价格 ?? 0,
        干基价格: raw.composition?.干基价格 ?? 0,
        分类编号: raw.category || '',
        矿耗: Number(val.矿耗) || 0,
      };

      // 🚨 如果是「煤比选择」对应的燃料 → 不加 配比
      if (id === coalRatioId) {
        fuelParams[val.name] = baseParams;
      } else {
        fuelParams[val.name] = {
          ...baseParams,
          配比: Number(val.配比) || 0,
        };
      }
    }

    const coalRatioName =
      fuelMaterials.find(r => r.id === coalRatioId)?.name ?? '';

    const cokeRatioName =
      fuelMaterials.find(r => r.id === cokeRatioId)?.name ?? '';

    // 6️⃣ 组装 otherSettings
    const finalOtherSettings = {
      综合入炉品位: mainParams?.['综合入炉品位'] ?? 0,
      燃料比: mainParams?.['燃料比'] ?? 0,
      煤比: mainParams?.['煤比'] ?? 0,
      焦比: mainParams?.['焦比'] ?? 0,
      焦丁比选择: cokeRatioName,
      煤比选择: coalRatioName,
      其他费用: task?.parameters?.['otherSettings']?.['其他费用'] ?? 0,
      导出名称: `${taskUuid}-${index}`
    };
    console.log('ingredientParams', ingredientParams);
    console.log('fuelParams', fuelParams);
    console.log('otherSettings', finalOtherSettings);
    return {
      ingredientParams,
      fuelParams,
      otherSettings: finalOtherSettings,
    };
  }

  async callFastApi(payload: {
    ingredientParams: any;
    fuelParams: any;
    otherSettings: any;
  }) {
    const response = await axios.post(
      `${this.fastApiUrl}/gl/export/excel/`,
      payload,
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(response.data);
  }


  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> { return axios.post(`${this.fastApiUrl}${path}`, data); }
  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> { return axios.get(`${this.fastApiUrl}${path}`, { params }); }
  private async findTask(taskUuid: string): Promise<Task | null> { return this.taskRepo.findOne({ where: { task_uuid: taskUuid } }); }
  private async saveResults(task: Task, results: any[]): Promise<void> { await this.resultRepo.save(this.resultRepo.create({ task, output_data: results, is_shared: false, finished_at: new Date() })); }
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> { const message = err instanceof Error ? err.message : String(err); this.logger.error(`${prefix}: ${message}`); return ApiResponse.error(message); }
}
