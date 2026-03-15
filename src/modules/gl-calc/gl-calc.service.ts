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
import { appConfig } from 'src/config/app.config';
import { SjCandidate } from '../sj-candidate/entities/sj-candidate.entity';
import { formatGLResultFull, sortGLResult } from '../../common/formatters/gl.formatter';
import { sortSJResult } from 'src/common/formatters/sj.formatter';


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
  private readonly fastApiUrl = appConfig.api.fastApiUrl;
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(GlMaterialInfo) private readonly glRawMaterialRepo: Repository<GlMaterialInfo>,
    @InjectRepository(SjCandidate) private readonly sjCandidateRepo: Repository<SjCandidate>,  // ✅ 新增燃料表

    private readonly glconfigService: GlConfigService,
  ) { }
  /** 启动高炉配料计算任务 */
  async startTask(
    moduleName: string,
    user: User
  ): Promise<ApiResponse<{ taskUuid: string; resultMap: Record<string, any> }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      // 1️⃣ 获取最新配置（含快照）
      const config = await this.glconfigService.getLatestIngredients(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);

      const safeNumber = (v: any, d = 0) => (v != null && !isNaN(Number(v)) ? Number(v) : d);

      // ---------------- 原料处理（使用快照） ----------------
      const ingredientData = config.ingredientData || [];
      const ingredientIds = config.ingredientParams || [];

      const ingredientParams: Record<string, any> = {};
      ingredientData.forEach(raw => {
        if (!ingredientIds.includes(raw.id)) return; // 只取当前选中的
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
        if (!ingredientIds.includes(Number(id))) return;
        ingredientLimits[id] = {
          low_limit: safeNumber(limit.low_limit),
          top_limit: safeNumber(limit.top_limit),
        };
      });

      // ---------------- 燃料处理（使用快照） ----------------
      const fuelData = config.fuelData || [];
      const fuelIds: number[] = config.fuelParams || [];

      const fuelParams: Record<string, any> = {};
      fuelData.forEach(fuel => {
        if (!fuelIds.includes(fuel.id)) return;
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
        if (!fuelIds.includes(id) || !limit) return;
        fuelLimits[String(id)] = {
          low_limit: safeNumber(limit.low_limit),
          top_limit: safeNumber(limit.top_limit),
        };
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
        ingredientData,   // ← 整个原料列表
        fuelData,         // ← 整个燃料列表
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

      // ID → Name 映射（用快照）
      const idNameMap: Record<number, string> = {};
      ingredientData.forEach(r => idNameMap[r.id] = r.name);
      fuelData.forEach(f => idNameMap[f.id] = f.name);

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

async fetchAndSaveProgress(
  taskUuid: string,
  pagination?: PaginationDto,
  forceSave = false
): Promise<ApiResponse<any>> {
  try {
    const task = await this.findTask(taskUuid);
    if (!task) return this.taskInitializingFallback(taskUuid, pagination);

    let results: any[] = [];
    const parameters = task.parameters || {};

    /** ================== 构建材料映射 ================== */
    const ingredientNameMap: Record<string, string> = {};
    const fuelNameMap: Record<string, string> = {};


    (parameters.ingredientData || []).forEach(item => {
      if (item?.id != null) {
        ingredientNameMap[String(item.id)] = item.name || '';
      }
    });

    (parameters.fuelData || []).forEach(item => {
      if (item?.id != null) {
        fuelNameMap[String(item.id)] = item.name || '';
      }
    });

    const FINAL_STATUS = [
      TaskStatus.PAUSED,
      TaskStatus.STOPPED,
      TaskStatus.FINISHED
    ];

    /** ================== FINAL状态 ================== */
    if (FINAL_STATUS.includes(task.status) && !forceSave) {
      const cache = this.taskCache.get(taskUuid);
      if (cache?.results?.length) {
        results = cache.results;
      } else {
        results = await this.loadResultsFromDb(taskUuid);
      }
      results = results.map(item => sortGLResult(item));
}
    /** ================== RUNNING状态 ================== */
    else {
      const res = await this.apiGet('/gl/progress/', { taskUuid });
      const data = res.data?.data;

      if (!data || !Array.isArray(data.results))
        throw new Error('FastAPI 返回异常');

      const cache = this.taskCache.get(taskUuid) || {
        results: [],
        lastUpdated: Date.now()
      };

      /** merge结果 */
      results = this.mergeResults(cache.results, data.results);

      const newStatus = this.mapFastApiStatusToTaskStatus(data.status);

      await this.updateTaskStatus(
        taskUuid,
        newStatus,
        data.progress,
        data.total
      );

      const needFormat =
        newStatus === TaskStatus.FINISHED ||
        newStatus === TaskStatus.PAUSED ||
        newStatus === TaskStatus.STOPPED ||
        forceSave;

      /** FINAL阶段格式化 */
      if (needFormat) {
        results = results.map(item =>
          formatGLResultFull(
            item,
            ingredientNameMap,
            fuelNameMap,
            parameters.ingredientLimits,
            parameters.fuelLimits,
            parameters.loadTopLimits,
            parameters.ironWaterTopLimits,
            parameters.slagLimits
          )
        );

        /** 成本排序 */
        results.sort((a, b) => a["主要参数"].成本 - b["主要参数"].成本);

        /** 成本排名 */
        results.forEach((item, idx) => {
          item.成本排名 = idx + 1;
        });

        const taskEntity = await this.findTask(taskUuid);

        if (taskEntity && results.length) {
          await this.saveResults(taskEntity, results);
        }
      }

      /** RUNNING阶段排序 */
      else {
        results.sort((a, b) => a["方案序号"] - b["方案序号"]);
        results.forEach(item => sortGLResult(item));
        /** 成本排名 */
        const sortedByCost = [...results].sort(
          (a, b) => a["主要参数"].成本 - b["主要参数"].成本
        );

        sortedByCost.forEach((item, idx) => {
          const target = results.find(r => r === item);
          if (target) target.成本排名 = idx + 1;
        });
      }

      /** 更新缓存 */
      this.taskCache.set(taskUuid, {
        results,
        lastUpdated: Date.now()
      });

      if (newStatus === TaskStatus.FINISHED)
        this.taskCache.delete(taskUuid);

      task.status = newStatus;
      task.progress = data.progress ?? task.progress;
      task.total = data.total ?? task.total;
    }

    /** ================== 分页 ================== */
    const { pagedResults, totalResults, totalPages } =
      this.applyPaginationAndSort(results, pagination);

    return ApiResponse.success({
      taskUuid: task.task_uuid,
      status: task.status,
      progress: task.progress,
      total: task.total,
      results: pagedResults,
      page: pagination?.page ?? 1,
      pageSize: pagination?.pageSize ?? 10,
      totalResults,
      totalPages
    });

  } catch (err) {
    this.logger.error(`fetch progress error ${taskUuid}`, err);
    return this.taskInitializingFallback(taskUuid, pagination);
  }
}

  /** ===================== 停止任务 ===================== */
  async stopTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 通知 FastAPI 停止
      await this.apiPost('/gl/stop/', { taskUuid });

      // 2️⃣ 强制整理并保存结果到数据库
      await this.fetchAndSaveProgress(taskUuid, undefined, true);

      // 3️⃣ 更新任务状态为 STOPPED
      await this.updateTaskStatus(taskUuid, TaskStatus.STOPPED);

      // 4️⃣ 清理缓存
      this.taskCache.delete(taskUuid);

      return ApiResponse.success({ taskUuid, status: 'stopped' }, '任务已停止并保存当前结果');
    } catch (err) {
      return this.handleError(err, '停止任务失败');
    }
  }

  async getSchemeByIndex(
    taskUuid: string,
    index: number
  ): Promise<any | null> {

    const results = await this.loadResultsFromDb(taskUuid);

    const scheme = results.find(
      item => Number(item['方案序号']) === Number(index)
    );

    if (!scheme) return null;

    // 只做排序
    return sortGLResult(scheme);
  }



  /** 导出单个高炉方案为 Excel，并整理所需参数 */
  async exportSchemeExcel(taskUuid: string, index: number) {

    // 1️⃣ 获取方案
    const scheme = await this.getSchemeByIndex(taskUuid, index);
    if (!scheme) throw new Error('方案不存在');
    const data = scheme;
    const ingredient = data['原料配比和矿耗'] || {};
    const fuel = data['燃料配比和矿耗'] || {};
    const mainParams = data['主要参数'] || {};

    // 2️⃣ 获取任务
    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid },
    });

    if (!task) throw new Error('任务不存在');

    const params = task.parameters || {};

    const ingredientParamsDB = params.ingredientParams || {};
    const fuelParamsDB = params.fuelParams || {};

    const ingredientData = params.ingredientData || [];
    const fuelData = params.fuelData || [];

    // ================== ID → Name 映射 ==================

    const ingredientNameMap: Record<string, string> = {};
    ingredientData.forEach(i => {
      ingredientNameMap[String(i.id)] = i.name;
    });

    const fuelNameMap: Record<string, string> = {};
    fuelData.forEach(f => {
      fuelNameMap[String(f.id)] = f.name;
    });

    // ================== ingredientParams ==================

    const ingredientParams: Record<string, any> = {};

    for (const id of Object.keys(ingredient)) {

      const schemeVal = ingredient[id];
      const base = ingredientParamsDB[id];

      if (!base) continue;

      const name = ingredientNameMap[id] || id;

      const category =
        ingredientData.find(i => String(i.id) === id)?.category || '';

      ingredientParams[name] = {
        返矿率: base['返矿率'] ?? 0,
        返矿价格: base['返矿价格'] ?? 0,
        干基价格: base['干基价格'] ?? 0,
        分类编号: category,
        矿耗: Number(schemeVal?.矿耗) || 0,
        配比: Number(schemeVal?.value) || 0,
      };
    }

    // ================== fuelParams ==================
    const fuelParams: Record<string, any> = {};
    const coalRatioId = String(params?.otherSettings?.['煤比选择'] ?? '');
    const cokeRatioId = String(params?.otherSettings?.['焦丁比选择'] ?? '');
    for (const id of Object.keys(fuel)) {
      const schemeVal = fuel[id];
      const base = fuelParamsDB[id];
      if (!base) continue;
      const name = fuelNameMap[id] || id;
      const category =
        fuelData.find(i => String(i.id) === id)?.category || '';

      const baseParams = {
        返焦率: base['返焦率'] ?? 0,
        返焦价格: base['返焦价格'] ?? 0,
        干基价格: base['干基价格'] ?? 0,
        分类编号: category,
        矿耗: Number(schemeVal?.矿耗) || 0,
      };

      // 煤比燃料不加配比
      if (id === coalRatioId) {
        fuelParams[name] = baseParams;
      } else {
        fuelParams[name] = {
          ...baseParams,
          配比: Number(schemeVal?.value) || 0,
        };
      }
    }

    // ================== otherSettings ==================

    const coalRatioName = fuelNameMap[coalRatioId] || '';
    const cokeRatioName = fuelNameMap[cokeRatioId] || '';

    const finalOtherSettings = {
      综合入炉品位: mainParams?.['综合入炉品位(%)'] ?? 0,
      燃料比: mainParams?.['燃料比(kg/t)'] ?? 0,
      煤比: mainParams?.['煤比(t/t)'] ?? 0,
      焦比: mainParams?.['焦比(t/t)'] ?? 0,
      焦丁比选择: cokeRatioName,
      煤比选择: coalRatioName,
      其他费用: params?.otherSettings?.['其他费用'] ?? 0,
      导出名称: `${taskUuid}-${index}`
    };
    console.log('ingredientParams:', ingredientParams);
    console.log('fuelParams:', fuelParams);
    console.log('otherSettings:', finalOtherSettings);
    console.log('原料数据:', ingredient);
    console.log('燃料数据:', fuel);
    console.log('主要参数:', mainParams);
    return {
      ingredientParams,
      fuelParams,
      otherSettings: finalOtherSettings,
    };
  }


  /** 导出单个高炉方案为 Excel，并整理所需参数 */
  async exportYTHSchemeExcel(taskUuid: string, index: number) {
    // 1️⃣ 获取方案
    const scheme = await this.getSchemeByIndex(taskUuid, index);
    if (!scheme) throw new Error('方案不存在');
    const data = scheme;
    const ingredient = data['原料配比和矿耗'] || {};
    const fuel = data['燃料配比和矿耗'] || {};
    const mainParams = data['主要参数'] || {};

    // 2️⃣ 获取任务
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (!task) throw new Error('任务不存在');

    const params = task.parameters || {};
    const ingredientData = params.ingredientData || [];
    const fuelData = params.fuelData || [];
    const ingredientParamsDB = params.ingredientParams || {};
    const fuelParamsDB = params.fuelParams || {};

    // 3️⃣ 构建 ID -> 名字映射
    const ingredientNameMap: Record<string, string> = {};
    ingredientData.forEach(i => ingredientNameMap[String(i.id)] = i.name);

    const fuelNameMap: Record<string, string> = {};
    fuelData.forEach(f => fuelNameMap[String(f.id)] = f.name);

    // 4️⃣ 变量选择
    const variableSelection: Record<string, string> = params?.otherSettings?.['变量选择'] || {};
    // 例: { "自产烧结矿": "64" }

    // 5️⃣ 读取 candidate 对应烧结矿序号
    const candidate = await this.sjCandidateRepo.findOne({
      where: { id: Number(data['烧结矿序号']) },
    });

    const candidateResult = candidate?.result || {};
    const candidateCost = candidateResult?.['主要参数']?.['成本(元/t)'] ?? null;

    console.log('变量选择:', variableSelection);
    console.log('烧结矿序号:', data['烧结矿序号']);
    console.log('候选成本:', candidateCost);

    // 6️⃣ 构建 ingredientParams
    const ingredientParams: Record<string, any> = {};
    for (const id of Object.keys(ingredient)) {
      const schemeVal = ingredient[id];
      const base = ingredientParamsDB[id];
      if (!base) continue;

      const name = ingredientNameMap[id] || id;
      const category = ingredientData.find(i => String(i.id) === id)?.category || '';

      let dryPrice = base['干基价格'] ?? 0;

      // ✅ 直接判断
      console.log('当前 ingredient ID:', id);
      console.log('当前 ingredient name:', name);
      console.log('默认干基价格:', dryPrice);
      console.log('variableSelection:', variableSelection);

      if (String(variableSelection) === id) {
        console.log(`✅ 匹配成功: ${name} 使用 sj_candidate 成本覆盖 ${candidateCost}`);
        dryPrice = candidateCost ?? dryPrice;
      }

      ingredientParams[name] = {
        返矿率: base['返矿率'] ?? 0,
        返矿价格: base['返矿价格'] ?? 0,
        干基价格: dryPrice,
        分类编号: category,
        矿耗: Number(schemeVal?.矿耗) || 0,
        配比: Number(schemeVal?.value) || 0,
      };
    }
    // 7️⃣ 构建 fuelParams
    const fuelParams: Record<string, any> = {};
    const coalRatioId = String(params?.otherSettings?.['煤比选择'] ?? '');
    const cokeRatioId = String(params?.otherSettings?.['焦丁比选择'] ?? '');

    for (const id of Object.keys(fuel)) {
      const schemeVal = fuel[id];
      const base = fuelParamsDB[id];
      if (!base) continue;

      const name = fuelNameMap[id] || id;
      const category = fuelData.find(i => String(i.id) === id)?.category || '';

      const baseParams = {
        返焦率: base['返焦率'] ?? 0,
        返焦价格: base['返焦价格'] ?? 0,
        干基价格: base['干基价格'] ?? 0,
        分类编号: category,
        矿耗: Number(schemeVal?.矿耗) || 0,
      };

      fuelParams[name] = id === coalRatioId
        ? baseParams
        : { ...baseParams, 配比: Number(schemeVal?.value) || 0 };
    }

    // 8️⃣ 构建其他参数
    const coalRatioName = fuelNameMap[coalRatioId] || '';
    const cokeRatioName = fuelNameMap[cokeRatioId] || '';
    const finalOtherSettings = {
      综合入炉品位: mainParams?.['综合入炉品位(%)'] ?? 0,
      燃料比: mainParams?.['燃料比(kg/t)'] ?? 0,
      煤比: mainParams?.['煤比(t/t)'] ?? 0,
      焦比: mainParams?.['焦比(t/t)'] ?? 0,
      焦丁比选择: cokeRatioName,
      煤比选择: coalRatioName,
      其他费用: params?.otherSettings?.['其他费用'] ?? 0,
      导出名称: `${taskUuid}-${index}`,
    };

    console.log('最终 ingredientParams:', ingredientParams);
    console.log('最终 fuelParams:', fuelParams);
    console.log('最终 otherSettings:', finalOtherSettings);

    return { ingredientParams, fuelParams, otherSettings: finalOtherSettings };
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
  /** ===================== 工具方法 ===================== */
  private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> {
    try { return await axios.post(`${this.fastApiUrl}${path}`, data); }
    catch (err: any) { throw new Error(err.response?.data?.message || err.message || '接口请求失败'); }
  }

  private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> {
    try { return await axios.get(`${this.fastApiUrl}${path}`, { params }); }
    catch (err: any) { throw new Error(err.response?.data?.message || err.message || '接口请求失败'); }
  }

  private async findTask(taskUuid: string): Promise<Task | null> {
    return this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
  }

  private async saveResults(task: Task, results: any[]): Promise<void> {
    // 先查找是否已有结果
    let entity = await this.resultRepo.findOne({
      where: { task: { task_uuid: task.task_uuid } }
    });

    if (!entity) {
      // 直接存对象，不用 JSON.stringify
      entity = this.resultRepo.create({
        task,
        output_data: results,   // ✅ 直接存数组对象
        is_shared: false,
        finished_at: new Date(),
      });
    } else {
      // 更新时也直接存对象
      entity.output_data = results;  // ✅ 直接存对象
      entity.finished_at = new Date();
    }

    await this.resultRepo.save(entity);
  }

  private mergeResults(oldResults: any[], newResults: any[]): any[] {
    const map = new Map<number, any>();
    [...oldResults, ...newResults].forEach(r => { if (r['方案序号'] != null) map.set(r['方案序号'], r); });
    return Array.from(map.values()).sort((a, b) => a['方案序号'] - b['方案序号']);
  }

  private async loadResultsFromDb(taskUuid: string): Promise<any[]> {
    const resultEntity = await this.resultRepo.findOne({ where: { task: { task_uuid: taskUuid } } });
    if (!resultEntity) return [];
    if (Array.isArray(resultEntity.output_data)) return resultEntity.output_data;
    if (typeof resultEntity.output_data === 'string') return JSON.parse(resultEntity.output_data);
    return resultEntity.output_data || [];
  }

  private async updateTaskStatus(taskUuid: string, status: TaskStatus, progress?: number, total?: number) {
    const task = await this.findTask(taskUuid);
    if (!task) return;
    task.status = status;
    if (progress != null) task.progress = progress;
    if (total != null) task.total = total;
    await this.taskRepo.save(task);
  }

  private mapFastApiStatusToTaskStatus(status: string): TaskStatus {
    switch (status) {
      case 'finished': return TaskStatus.FINISHED;
      case 'paused': return TaskStatus.PAUSED;
      case 'running': return TaskStatus.RUNNING;
      default: return TaskStatus.INITIALIZING;
    }
  }

  private applyPaginationAndSort(results: any[], pagination?: PaginationDto, task?: Task) {
    let sortedResults = results;

    if (pagination?.sort) {
      const order = pagination.order === 'desc' ? -1 : 1;
      sortedResults = [...results].sort((a, b) => {
        let va = getNestedValue(a, pagination.sort!);
        let vb = getNestedValue(b, pagination.sort!);
        const na = Number(va), nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) { va = na; vb = nb; } else { va = va ? String(va) : ''; vb = vb ? String(vb) : ''; }
        return va > vb ? order : va < vb ? -order : 0;
      });
    }

    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 10;
    const start = (page - 1) * pageSize;

    return {
      pagedResults: sortedResults.slice(start, start + pageSize),
      totalResults: sortedResults.length,
      totalPages: Math.ceil(sortedResults.length / pageSize),
      taskUuid: task?.task_uuid,
      status: task?.status,
      progress: task?.progress,
      total: task?.total
    };
  }

  private taskInitializingFallback(taskUuid: string, pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 10;
    return ApiResponse.success({
      taskUuid,
      status: 'initializing',
      progress: 0,
      total: 0,
      results: [],
      page,
      pageSize,
      totalResults: 0,
      totalPages: 0,
    }, '任务初始化中');
  }

  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
    return ApiResponse.error(message);
  }

  /** 暂停任务 */
 async pauseTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');
      if (task.status !== TaskStatus.RUNNING) return ApiResponse.error('任务当前状态不可暂停');

      // 1️⃣ 通知 FastAPI 暂停
      await this.apiPost('/gl/pause/', { taskUuid });
      await this.waitFastApiPause(taskUuid);

      // 2️⃣ 强制整理并保存结果到数据库
      await this.fetchAndSaveProgress(taskUuid, undefined, true);

      // 3️⃣ 更新任务状态为 PAUSED
      await this.updateTaskStatus(taskUuid, TaskStatus.PAUSED);

      // 4️⃣ 清理缓存
      this.taskCache.delete(taskUuid);

      return ApiResponse.success({ taskUuid, status: 'paused' }, '任务已暂停并保存整理好的结果');
    } catch (err) {
      return this.handleError(err, '暂停任务失败');
    }
  }
  private async waitFastApiPause(taskUuid: string, maxWait = 15000, interval = 300): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const res = await this.apiGet('/sj/progress/', { taskUuid });
        const status = res.data?.data?.status;

        // ✅ 只在状态真正是 paused 时返回
        if (status === 'paused') return;

        // 可选：如果返回 finished，也立即返回
        if (status === 'finished') return;

      } catch (err) {
        // 遇到网络或临时异常，继续轮询，不立即失败
        console.warn(`轮询暂停状态失败，taskUuid=${taskUuid}`, err);
      }

      // 等待 interval 再轮询
      await new Promise(r => setTimeout(r, interval));
    }

    throw new Error(`等待后端暂停超时 taskUuid=${taskUuid}`);
  }


  /** 继续任务 */
  async resumeTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {

    try {

      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 调用 FastAPI 继续
      const res = await this.apiPost('/gl/resume/', { taskUuid });

      const runningStatus = res.data?.data?.status;

      if (runningStatus === 'running') {

        task.status = TaskStatus.RUNNING;

        // 2️⃣ 同步最新进度
        const progressRes = await this.apiGet('/gl/progress/', { taskUuid });
        const progressData = progressRes.data?.data;

        task.progress = progressData?.progress ?? task.progress;
        task.total = progressData?.total ?? task.total;

        await this.taskRepo.save(task);

        return ApiResponse.success(
          { taskUuid, status: 'running' },
          '任务已继续'
        );
      }

      return ApiResponse.error(res.data?.message || '继续失败');

    } catch (err: unknown) {
      return this.handleError(err, '继续任务失败');
    }
  }






}
