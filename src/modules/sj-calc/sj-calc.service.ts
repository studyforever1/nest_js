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
import { v4 as uuidv4 } from 'uuid';
import { appConfig } from '../../config/app.config';

interface IngredientData {
  id: number;
  name: string;
  origin?: string;
  category?: string;
  composition?: {
    H2O?: number;
    价格?: number;
  };
}

const mainParamUnitMap: Record<string, string> = {
  成本: '成本(元/t)',
  吨度价: '吨度价',
  干基总消耗: '干基总消耗(t/t)',
  干基总残存: '干基总残存(%)',
  预测烧结烟气含流量: '预测烧结烟气含流量(mg/Nm3)',
};


const mainParamOrder = [
  '成本(元/t)',
  '吨度价',
  '干基总消耗(t/t)',
  '干基总残存(%)',
  '预测烧结烟气含流量(mg/Nm3)'
];

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
  private readonly fastApiUrl = appConfig.api.fastApiUrl;

  /** 内存缓存：taskUuid -> TaskCache */
  private taskCache: Map<string, TaskCache> = new Map();

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Result) private readonly resultRepo: Repository<Result>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(SjRawMaterial) private readonly sjRawMaterialRepo: Repository<SjRawMaterial>,
    private readonly sjconfigService: SjconfigService,
  ) { }

  /** 启动计算任务 */
  /** 启动计算任务（支持 taskUuid 未及时返回 → 初始化中） */


  async startTask(
    moduleName: string,
    user: User,
  ): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      this.logger.debug(`准备启动任务，userId=${user.user_id}, module=${moduleName}`);

      /** 1️⃣ NestJS 生成 taskUuid（核心） */
      const taskUuid = uuidv4();

      // ================= 原有参数准备逻辑（几乎不动） =================

      const config = await this.sjconfigService.getLatestConfigByName(user, moduleName);
      if (!config) throw new Error(`未找到模块 ${moduleName} 的配置`);
      console.log('获取到的配置:', config);
      const ingredientData = config.ingredientData || [];

      const ingredientParams: Record<number, any> = {};
      ingredientData.forEach(raw => {
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
        ingredientData,
        ingredientParams,
        ingredientLimits: ingredientLimitsClean,
        chemicalLimits: config.chemicalLimits || {},
        otherSettings: config.otherSettings || {},
      };
      console.log('启动任务参数:', fullParams);
      // ================= 2️⃣ 先保存任务（INITIALIZING） =================

      const task = this.taskRepo.create({
        task_uuid: taskUuid,
        module_type: moduleName,
        status: TaskStatus.INITIALIZING,
        parameters: fullParams,
        user,
      });
      await this.taskRepo.save(task);

      // 初始化内存缓存
      this.taskCache.set(taskUuid, { results: [], lastUpdated: Date.now() });

      // ================= 3️⃣ 后台启动 FastAPI（不 await） =================

      this.startFastApiTask(taskUuid, fullParams)
        .catch(err => {
          this.logger.error(`FastAPI 启动失败 task=${taskUuid}: ${err.message}`);
        });

      // ================= 4️⃣ 立即返回给前端 =================

      return ApiResponse.success(
        {
          taskUuid,
          status: 'INITIALIZING',
        },
        '任务已创建，正在启动中',
      );

    } catch (err: unknown) {
      return this.handleError(err, '启动任务失败');
    }
  }

  private async startFastApiTask(taskUuid: string, fullParams: any) {
    try {
      await this.apiPost('/sj/start/', {
        taskUuid,          // ⭐ FastAPI 必须接收这个
        ...fullParams,
      });

      // 启动成功 → RUNNING
      await this.taskRepo.update(
        { task_uuid: taskUuid },
        { status: TaskStatus.RUNNING },
      );
    } catch (err) {
      // 启动失败 → FAILED
      await this.taskRepo.update(
        { task_uuid: taskUuid },
        { status: TaskStatus.FAILED },
      );
      throw err;
    }
  }


  /** 停止任务 */
  async stopTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {

    try {

      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 先获取当前结果
      const resProgress = await this.apiGet('/sj/progress/', { taskUuid });

      const results = resProgress.data?.data?.results || [];

      // 2️⃣ 通知 FastAPI 停止
      await this.apiPost('/sj/stop/', { taskUuid });

      // 3️⃣ 保存结果
      if (results.length > 0) {
        await this.saveResults(task, results);
      }

      // 4️⃣ 更新任务状态
      task.status = TaskStatus.STOPPED;
      task.progress = resProgress.data.data.progress;
      task.total = resProgress.data.data.total;

      await this.taskRepo.save(task);

      // 5️⃣ 清理缓存
      this.taskCache.delete(taskUuid);

      return ApiResponse.success(
        { taskUuid, status: 'stopped' },
        '任务已停止并保存当前结果'
      );

    } catch (err: unknown) {
      return this.handleError(err, '停止任务失败');
    }
  }

  /** 查询任务进度（增量返回 + 分页排序 + 总页数） */
  /** 查询任务进度（增量 + 分页排序 + 总页数 + 完成任务返回最终结果） */
  /** 查询任务进度（增量 + 分页排序 + 总页数 + 完成任务返回最终结果） */
  async fetchAndSaveProgress(
    taskUuid: string,
    pagination?: PaginationDto
  ): Promise<ApiResponse<any>> {

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

      // ================= 🔥 构建原料快照映射 =================
      const ingredientData: any[] = task.parameters?.ingredientData || [];
      const ingredientLimits: Record<string, any> =
        task.parameters?.ingredientLimits || {};
      const chemicalLimits = task.parameters?.chemicalLimits || {};
      const idNameMap: Record<string, string> = {};
      ingredientData.forEach(item => {
        if (item?.id != null && item?.name) {
          idNameMap[String(item.id)] = item.name;
        }
      });
      const idCategoryMap: Record<string, string> = {};

      ingredientData.forEach(item => {
        if (item?.id != null) {
          idCategoryMap[String(item.id)] = item.category || '';
        }
      });
      // ================= 未完成任务 =================
      if (task.status !== TaskStatus.FINISHED) {

        const res = await this.apiGet('/sj/progress/', { taskUuid });
        const { code, message, data } = res.data;

        if (code !== 0 || !data)
          throw new Error(message || 'FastAPI 返回异常');

        if (!Array.isArray(data.results))
          throw new Error('FastAPI 返回 results 不是数组');

        // 过滤有效方案
        const validResults = data.results.filter(item =>
          item &&
          item["主要参数"] &&
          typeof item["主要参数"].成本 === "number" &&
          typeof item["主要参数"].吨度价 === "number"
        );

        // ================= 🔥 合并缓存 =================
        const cache = this.taskCache.get(taskUuid) || {
          results: [],
          lastUpdated: Date.now()
        };

        const combinedMap: Record<string, any> = {};

        // 先加入历史
        cache.results.forEach(item => {
          if (item?.方案序号 != null) {
            combinedMap[String(item.方案序号)] = item;
          }
        });

        // 再加入新结果（覆盖同编号）
        validResults.forEach(item => {
          if (item?.方案序号 != null) {
            combinedMap[String(item.方案序号)] = item;
          }
        });

        results = Object.values(combinedMap)
          .sort((a, b) => a["方案序号"] - b["方案序号"]);

        // ================= 成本排序 =================
        results.sort((a, b) =>
          a["主要参数"].成本 - b["主要参数"].成本
        );

        results.forEach((item, index) => {
          item.成本排名 = index + 1;
        });

        // ================= 吨度价排序 =================
        [...results]
          .sort((a, b) =>
            a["主要参数"].吨度价 - b["主要参数"].吨度价
          )
          .forEach((item, index) => {
            item.吨度价排名 = index + 1;
          });

        // ================= 名称映射 =================
        results = results.map(item => {

          const mapped: Record<string, any> = { ...item };

          if (item["原料配比"]) {

            const entries = Object.entries(item["原料配比"]);

            // 🔥 分类优先级函数
            const getPriority = (id: string) => {
              const category = idCategoryMap[id] || '';

              if (category.startsWith('T')) return 1;
              if (category.startsWith('X')) return 2;
              if (category.startsWith('R')) return 3;
              if (category.startsWith('F')) return 4;
              return 5;
            };

            // 🔥 排序
            entries.sort(([idA], [idB]) => {

              const pA = getPriority(idA);
              const pB = getPriority(idB);

              if (pA !== pB) return pA - pB;

              const catA = idCategoryMap[idA] || '';
              const catB = idCategoryMap[idB] || '';

              if (catA !== catB) return catA.localeCompare(catB);

              return Number(idA) - Number(idB);
            });

            const newMix: Record<string, any> = {};

            entries.forEach(([code, val]: [string, any], index: number) => {

              if (val?.value != null) {

                const ratio = Number(((val.value ?? 0)).toFixed(2));

                const limits = ingredientLimits[code] || {};

                newMix[code] = {
                  ...val,
                  name:
                    idNameMap[code] ||
                    limits.name ||
                    code,
                  value: ratio,
                  sortIndex: index + 1,
                  low_limit: limits.low_limit ?? null,
                  top_limit: limits.top_limit ?? null
                };
              }

            });

            mapped["原料配比"] = newMix;
          }
          // ================= 化学成分处理 =================
          if (item["化学成分"]) {

            const chemicalSource = item["化学成分"];
            const chemicalWithLimits: Record<string, any> = {};

            Object.keys(chemicalSource).forEach(key => {

              const limits = chemicalLimits[key] || {};
              const val = chemicalSource[key];

              // 🔥 如果已经是完整结构，就不要再包一层
              if (typeof val === 'object' && val !== null && 'value' in val) {

                chemicalWithLimits[key] = {
                  ...val,
                  low_limit: val.low_limit ?? limits.low_limit ?? null,
                  top_limit: val.top_limit ?? limits.top_limit ?? null,
                };

              } else {

                chemicalWithLimits[key] = {
                  value: val,
                  low_limit: limits.low_limit ?? null,
                  top_limit: limits.top_limit ?? null,
                };

              }

            });

            mapped["化学成分"] = chemicalWithLimits;
          }
          // ================= 主要参数加单位 =================
          // ================= 主要参数排序 + 单位 =================
          if (item["主要参数"]) {

            const originalMain = item["主要参数"];
            const newMain: Record<string, any> = {};

            // 先转换 key
            const converted: Record<string, any> = {};

            Object.keys(originalMain).forEach(key => {
              const newKey = mainParamUnitMap[key] || key;
              converted[newKey] = originalMain[key];
            });

            // 按固定顺序排序
            mainParamOrder.forEach(key => {
              if (converted[key] !== undefined) {
                newMain[key] = converted[key];
              }
            });

            // 补充其他字段
            Object.keys(converted).forEach(key => {
              if (!newMain.hasOwnProperty(key)) {
                newMain[key] = converted[key];
              }
            });

            mapped["主要参数"] = newMain;
          }
          return mapped;
        });

        // ================= 更新缓存 =================
        cache.results = results;
        cache.lastUpdated = Date.now();
        this.taskCache.set(taskUuid, cache);

        // ================= 更新任务状态 =================
        if (data.status === 'finished') {
          task.status = TaskStatus.FINISHED;
        }
        else if (data.status === 'paused') {
          task.status = TaskStatus.PAUSED;
        }
        else {
          task.status = TaskStatus.RUNNING;
        }

        task.progress = data.progress ?? task.progress;
        task.total = data.total ?? task.total;

        await this.taskRepo.save(task);

        // ================= 完成任务时保存结果 =================
        if (task.status === TaskStatus.FINISHED && results.length) {

          const exist = await this.resultRepo.findOne({
            where: { task: { task_uuid: taskUuid } }
          });

          if (!exist) {
            await this.saveResults(task, results);
          }

          this.taskCache.delete(taskUuid);
        }

      } else {

        // ================= 已完成任务 =================
        const cache = this.taskCache.get(taskUuid);

        if (cache?.results?.length) {
          results = cache.results;
        } else {
          const resultEntity =
            await this.resultRepo.findOne({
              where: { task: { task_uuid: taskUuid } }
            });

          if (!resultEntity) {
            results = [];
          }
          else if (typeof resultEntity.output_data === 'string') {
            results = JSON.parse(resultEntity.output_data);
          }
          else {
            results = resultEntity.output_data || [];
          }
        }
      }

      // ================= 分页 =================
      const {
        pagedResults,
        totalResults,
        totalPages
      } = this.applyPaginationAndSort(results, pagination);

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
      // 11️⃣ 异常 fallback → 返回初始化状态
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
      output_data: JSON.stringify(results),   // ⭐关键修改
      is_shared: false,
      finished_at: new Date(),
    });

    await this.resultRepo.save(resultEntity);
  }
  private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
    return ApiResponse.error(message);
  }
  async getSchemeByIndex(
    taskUuid: string,
    index: number
  ): Promise<any | null> {

    const resultEntity = await this.resultRepo.findOne({
      where: { task: { task_uuid: taskUuid } },
    });

    if (!resultEntity) return null;

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

    const scheme = allResults.find(
      item => Number(item['方案序号']) === Number(index)
    );

    if (!scheme) return null;

    // ================= 化学成分排序 =================

    const chemicalOrder = [
      'TFe', 'SiO2', 'CaO', 'MgO', 'Al2O3',
      'P', 'S', 'TiO2', 'K2O', 'Na2O',
      'Zn', 'As', 'Pb', 'V2O5', 'R2', '镁铝比'
    ];

    const sourceChemical = scheme['化学成分'] || {};
    const sortedChemical: Record<string, any> = {};

    chemicalOrder.forEach(key => {
      if (sourceChemical.hasOwnProperty(key)) {
        sortedChemical[key] = sourceChemical[key];
      }
    });

    Object.keys(sourceChemical).forEach(key => {
      if (!sortedChemical.hasOwnProperty(key)) {
        sortedChemical[key] = sourceChemical[key];
      }
    });

    // ================= 主要参数排序 =================

    const mainParamOrder = [
      '成本(元/t)',
      '吨度价',
      '干基总消耗(t/t)',
      '干基总残存(%)',
      '预测烧结烟气含流量(mg/Nm3)'
    ];

    const sourceMain = scheme['主要参数'] || {};
    const sortedMain: Record<string, any> = {};

    mainParamOrder.forEach(key => {
      if (sourceMain.hasOwnProperty(key)) {
        sortedMain[key] = sourceMain[key];
      }
    });

    Object.keys(sourceMain).forEach(key => {
      if (!sortedMain.hasOwnProperty(key)) {
        sortedMain[key] = sourceMain[key];
      }
    });

    return {
      ...scheme,
      '化学成分': sortedChemical,
      '主要参数': sortedMain
    };
  }

  /** 导出单个方案为 Excel，并整理所需参数 */
  /** 导出单个方案为 Excel，并整理所需参数 */
  async exportSchemeExcel(taskUuid: string, index: number) {

    // 1️⃣ 获取方案
    const scheme = await this.getSchemeByIndex(taskUuid, index);

    if (!scheme) {
      throw new Error('方案不存在');
    }

    const ingredientWithLimits = scheme["原料配比"] || {};
    const mainParams = scheme["主要参数"] || {};
    const chemical = scheme["化学成分"] || {};

    // 2️⃣ 获取任务
    const task = await this.taskRepo.findOne({
      where: { task_uuid: taskUuid },
    });

    if (!task) {
      throw new Error("任务不存在");
    }

    const parameters = task.parameters || {};

    // 3️⃣ 获取原料快照数据
    const ingredientData: IngredientData[] =
      parameters.ingredientData || [];

    // 4️⃣ 构建原料 Map（提高查找效率）
    const ingredientMap = new Map<number, IngredientData>(
      ingredientData.map(item => [item.id, item])
    );

    // 5️⃣ 组装 ingredientParams（给 FastAPI）
    const ingredientParams: Record<string, any> = {};

    for (const idStr of Object.keys(ingredientWithLimits)) {

      const id = Number(idStr);
      const val = ingredientWithLimits[id];

      const raw = ingredientMap.get(id);

      if (!raw) continue;

      ingredientParams[val.name] = {
        原料产地: raw.origin || "",
        分类编号: raw.category || "",
        H2O: raw.composition?.H2O ?? 0,
        价格: raw.composition?.价格 ?? 0,
        lose_index: val?.lose_index ?? 1,
        配比: Number(val?.value) || 0,
      };
    }

    // 6️⃣ 组装 otherSettings
    const finalOtherSettings = {

      ...parameters.otherSettings,

      综合品位:
        chemical?.TFe?.value ??
        chemical?.TFe ??
        0,

      干基总残存:
        mainParams["干基总残存(%)"] ??
        mainParams["干基总残存"] ??
        0,

      成本:
        mainParams["成本(元)"] ??
        mainParams["成本"] ??
        0,

      吨度价:
        mainParams["吨度价"] ??
        0,
      品位:
        chemical?.TFe?.value ??
        chemical?.TFe ??
        0,

      其他费用:
        parameters?.otherSettings?.["其他费用"] ?? 0,

      导出名称: `${taskUuid}-${index}`,
    };

    this.logger.debug(
      "Excel导出参数: " +
      JSON.stringify(
        {
          ingredientParams,
          otherSettings: finalOtherSettings,
        },
        null,
        2
      )
    );

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

  /** 暂停任务 */
  /** 暂停任务 */
  /** 暂停任务 */
async pauseTask(
  taskUuid: string
): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
  try {
    const task = await this.findTask(taskUuid);
    if (!task) return ApiResponse.error('任务不存在');

    if (task.status !== TaskStatus.RUNNING) {
      return ApiResponse.error('任务当前状态不可暂停');
    }

    // 1️⃣ 发出暂停信号
    const res = await this.apiPost('/sj/pause/', { taskUuid });
    if (res.status !== 200) {
      return ApiResponse.error(res.data?.message || '暂停失败');
    }

    // 2️⃣ 轮询等待后端真正暂停
    const interval = 500; // 每 0.5 秒
    const maxWait = 10000; // 最多等待 10 秒
    let elapsed = 0;
    let paused = false;
    let progress = task.progress;
    let total = task.total;

    while (elapsed < maxWait) {
      const check = await this.apiGet('/sj/progress/', { taskUuid });
      const status = check.data?.data?.status;

      if (status === 'paused') {
        paused = true;
        progress = check.data?.data?.progress ?? progress;
        total = check.data?.data?.total ?? total;
        break;
      }

      await new Promise(r => setTimeout(r, interval));
      elapsed += interval;
    }

    if (!paused) {
      return ApiResponse.error('等待后端暂停超时');
    }

    // 3️⃣ 从缓存取整理好的结果
    const cache = this.taskCache.get(taskUuid);
    const results = cache?.results || [];

    if (results.length > 0) {
      let resultEntity = await this.resultRepo.findOne({
        where: { task: { task_uuid: taskUuid } },
      });

      if (resultEntity) {
        resultEntity.output_data = results;
        resultEntity.finished_at = new Date();
        await this.resultRepo.save(resultEntity);
      } else {
        await this.resultRepo.save({
          task,
          output_data: results,
          is_shared: false,
          finished_at: new Date(),
        });
      }
    }

    // 4️⃣ 更新任务状态
    task.status = TaskStatus.PAUSED;
    task.progress = progress;
    task.total = total;
    await this.taskRepo.save(task);

    // 5️⃣ 可选：清理缓存
    this.taskCache.delete(taskUuid);

    return ApiResponse.success(
      { taskUuid, status: 'paused' },
      '任务已暂停并保存整理好的结果'
    );
  } catch (err) {
    return this.handleError(err, '暂停任务失败');
  }
}

  /** 继续任务 */
  async resumeTask(taskUuid: string): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
    try {
      const task = await this.findTask(taskUuid);
      if (!task) return ApiResponse.error('任务不存在');

      // 1️⃣ 调用 FastAPI 继续
      const res = await this.apiPost('/sj/resume/', { taskUuid });
      const runningStatus = res.data?.data?.status;

      if (runningStatus === 'running') {
        task.status = TaskStatus.RUNNING;

        // 2️⃣ 拉取最新进度，保持进度同步
        const progressRes = await this.apiGet('/sj/progress/', { taskUuid });
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
