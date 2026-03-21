import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import _ from 'lodash';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { SjEconInfo } from '../sj-econ-info/entities/sj-econ-info.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { TaskProgressQueryDto } from './dto/sj-econ-pagination.dto';
import { appConfig } from '../../config/app.config';
import { SjRawMaterial } from '../sj-raw-material/entities/sj-raw-material.entity';
import { PortIronOreInfo } from '../port-iron-ore-info/entities/port-iron-ore-info.entity';
import { EconDataSourceType } from './enums/econ-data-source-type.enum';
import { EconSummaryDto } from './dto/econ-summary.dto';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

@Injectable()
export class SjEconCalcService {
    private readonly logger = new Logger(SjEconCalcService.name);
    private readonly fastApiUrl = appConfig.api.fastApiUrl;

    private readonly ECON_TASKS = [
        { name: '品位综合评价法', startUrl: '/sjEcon1/start/', progressUrl: '/sjEcon1/progress/', stopUrl: '/sjEcon1/stop/' },
        { name: '单烧综合评价法', startUrl: '/sjEcon2/start/', progressUrl: '/sjEcon2/progress/', stopUrl: '/sjEcon2/stop/' },
        { name: '铁水成本评价法', startUrl: '/sjEcon3/start/', progressUrl: '/sjEcon3/progress/', stopUrl: '/sjEcon3/stop/' },
        { name: '基准矿粉对比评价法', startUrl: '/sjEcon4/start/', progressUrl: '/sjEcon4/progress/', stopUrl: '/sjEcon4/stop/' },
    ];

    constructor(
        @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
        @InjectRepository(SjEconInfo) private readonly rawRepo: Repository<SjEconInfo>,
        @InjectRepository(ConfigGroup) private readonly configRepo: Repository<ConfigGroup>,
        @InjectRepository(BizModule) private readonly moduleRepo: Repository<BizModule>,
        @InjectRepository(SjRawMaterial) private readonly sjRawRepo: Repository<SjRawMaterial>,
        @InjectRepository(PortIronOreInfo) private readonly portIronRepo: Repository<PortIronOreInfo>,
    ) { }

    async startEconCalc(
  user: User,
  calculateType: string,
  dataSourceType: EconDataSourceType
): Promise<ApiResponse<{ tasks: { taskUuid: string; name: string }[]; status: string }>> {
  try {
    const group = await this.configRepo.findOne({
      where: { user: { user_id: user.user_id }, module: { name: calculateType }, is_latest: true },
    });
    if (!group) throw new Error(`模块 "${calculateType}" 没有参数组`);

    const configData = _.cloneDeep(group.config_data);

    // 2️⃣ 获取原料数据
      let raws: any[] = [];
      switch (dataSourceType) {
        case EconDataSourceType.ECON:
          {
            const ingredientIds: number[] = configData.ingredientParams || [];
            raws = ingredientIds.length ? await this.rawRepo.findByIds(ingredientIds) : [];
          }
          break;
        case EconDataSourceType.SJ_RAW:
          raws = await this.sjRawRepo.find({ where: { category: Like('T%'), enabled: true } });
          if (!raws.length) throw new Error('未找到分类编号以 T 开头的烧结物料');
          break;
        case EconDataSourceType.PORT_IRON:
          raws = await this.portIronRepo.find({ where: { enabled: true } });
          if (!raws.length) throw new Error('未找到可用的港口矿粉');
          break;
        default:
          throw new Error('未知数据来源类型');
      }


    // 构造 ingredientParams
    // 3️⃣ 构造 ingredientParams
      const ingredientParams: Record<string | number, any> = {};
      raws.forEach(raw => {
        ingredientParams[raw.id] = {
          Al2O3: raw.composition?.Al2O3 ?? 0,
          As: raw.composition?.As ?? 0,
          CaO: raw.composition?.CaO ?? 0,
          Cr: raw.composition?.Cr ?? 0,
          Cu: raw.composition?.Cu ?? 0,
          K2O: raw.composition?.K2O ?? 0,
          MgO: raw.composition?.MgO ?? 0,
          MnO: raw.composition?.MnO ?? 0,
          Na2O: raw.composition?.Na2O ?? 0,
          P: raw.composition?.P ?? 0,
          Pb: raw.composition?.Pb ?? 0,
          S: raw.composition?.S ?? 0,
          SiO2: raw.composition?.SiO2 ?? 0,
          TFe: raw.composition?.TFe ?? 0,
          TiO2: raw.composition?.TiO2 ?? 0,
          V: raw.composition?.V ?? 0,
          Zn: raw.composition?.Zn ?? 0,
          价格: raw.composition?.['价格'] ?? raw.composition?.['干粉价格'] ?? 0,
          烧损: raw.composition?.['烧损'] ?? 0,
        };
      });

    const fullParams = {
      ingredientParams,
      ironCostSet: configData.ironCostSet || {},
      singleBurnSet: configData.singleBurnSet || {},
    };

    this.logger.debug('启动经济性评价任务参数:', JSON.stringify(fullParams, null, 2));

    // 启动任务
    const tasks: { taskUuid: string; name: string }[] = [];
    for (const taskDef of this.ECON_TASKS) {
      try {
        const res: AxiosResponse<any> = await this.apiPost(taskDef.startUrl, fullParams);
        const taskUuid = res.data?.data?.taskUuid;
        if (taskUuid) {
          tasks.push({ taskUuid, name: taskDef.name });
          const task = this.taskRepo.create({
            task_uuid: taskUuid,
            module_type: taskDef.name,
            status: TaskStatus.RUNNING,
            parameters: fullParams,
            user,
          });
          await this.taskRepo.save(task);
        }
      } catch (err) {
        this.logger.warn(`启动 ${taskDef.name} 失败: ${(err as any)?.message || err}`);
      }
    }

    return ApiResponse.success({ tasks, status: 'RUNNING' }, '经济性评价任务已启动');
  } catch (err: unknown) {
    return this.handleError(err, '启动经济性评价任务失败');
  }
}

    async stopTasks(taskUuids: string[]): Promise<ApiResponse<{ stopped: string[] }>> {
        const stopped: string[] = [];
        for (let i = 0; i < taskUuids.length; i++) {
            const taskUuid = taskUuids[i];
            const taskDef = this.ECON_TASKS[i];
            try {
                await this.apiPost(taskDef.stopUrl, { taskUuid });
                stopped.push(taskUuid);

                const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
                if (task) {
                    task.status = TaskStatus.STOPPED;
                    await this.taskRepo.save(task);
                }
            } catch (err) {
                this.logger.warn(`停止任务 ${taskUuid} 失败: ${(err as any)?.message || err}`);
            }
        }
        return ApiResponse.success({ stopped }, '已停止任务');
    }

async fetchEconProgress(
  taskUuid: string,
  dataSourceType: EconDataSourceType,
  pagination?: TaskProgressQueryDto
): Promise<ApiResponse<any>> {
  try {
    // 1️⃣ 查询任务
    const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
    if (!task) return ApiResponse.error('任务不存在');

    const taskDef = this.ECON_TASKS.find(t => t.name === task.module_type);
    if (!taskDef) return ApiResponse.error('任务定义不存在');

    // 2️⃣ 调用 FastAPI 查询进度
    const res = await this.apiGet(taskDef.progressUrl, { taskUuid });
    const data = res.data?.data;

    if (!data) {
      return ApiResponse.success({
        taskUuid,
        status: 'RUNNING',
        results: [],
        page: pagination?.page ?? 1,
        pageSize: pagination?.pageSize ?? 10,
        totalResults: 0,
        totalPages: 0,
      });
    }

    // 3️⃣ 收集原料 ID
    const idSet = new Set<number>();
    (data.results || []).forEach(item => {
      const rawId = Number(item['原料']);
      if (!isNaN(rawId)) idSet.add(rawId);
    });

    // 4️⃣ 查询原料名称
    let raws: any[] = [];
    switch (dataSourceType) {
      case EconDataSourceType.ECON:
        raws = idSet.size ? await this.rawRepo.find({ where: { id: In([...idSet]) } }) : [];
        break;
      case EconDataSourceType.SJ_RAW:
        raws = idSet.size ? await this.sjRawRepo.find({ where: { id: In([...idSet]) } }) : [];
        break;
      case EconDataSourceType.PORT_IRON:
        raws = idSet.size ? await this.portIronRepo.find({ where: { id: In([...idSet]) } }) : [];
        break;
    }

    const idNameMap: Record<number, string> = {};
    raws.forEach(raw => (idNameMap[raw.id] = raw.name));

    // 5️⃣ 映射结果（⚡ 保留 rawId）
    let mappedResults = (data.results || []).map(item => {
      const rawId = Number(item['原料']);
      return {
        ...item,
        rawId, // ✅ 唯一标识（核心）
        原料: idNameMap[rawId] || item['原料'],
      };
    });

    // 6️⃣ ⚡ 性价比排名（已修复同名问题）
    const rankFields = [
      '单品位价格折算后',
      '烧结矿单品位价折算后',
      '生铁成本',
      '与PB粉对比'
    ];

    const rankField = rankFields.find(f =>
      mappedResults.some(item => !isNaN(Number(item[f])))
    );

    if (rankField) {
      const resultsWithValue = mappedResults
        .filter(item => !isNaN(Number(item[rankField])))
        .sort((a, b) => Number(a[rankField]) - Number(b[rankField])); // 升序

      // ✅ 用 rawId 做 key（彻底解决重名问题）
      const rankMap = new Map<number, number>();

      resultsWithValue.forEach((item, index) => {
        rankMap.set(item.rawId, index + 1);
      });

      mappedResults = mappedResults.map(item => {
        const rank = rankMap.get(item.rawId);

        if (rank === undefined) return item;

        return {
          性价比排名: rank,
          ...item,
        };
      });
    }

    // 7️⃣ 分页 + 排序
    const { pagedResults, totalResults, totalPages } =
      this.applyPaginationAndSort(mappedResults, pagination);

    return ApiResponse.success({
      taskUuid,
      status: data.status,
      progress: data.progress ?? 0,
      total: data.total ?? 0,
      results: pagedResults,
      page: pagination?.page ?? 1,
      pageSize: pagination?.pageSize ?? 10,
      totalResults,
      totalPages,
    });

  } catch (err) {
    return this.handleError(err, '获取经济性任务进度失败');
  }
}

    private applyPaginationAndSort(results: any[], pagination?: TaskProgressQueryDto) {
        let sortedResults = results;

        if (pagination?.sort) {
            const fieldPath = pagination.sort;
            const order = pagination.order === 'desc' ? -1 : 1;

            sortedResults = [...results].sort((a, b) => {
                const va = this.getNestedValue(a, fieldPath);
                const vb = this.getNestedValue(b, fieldPath);

                const na = Number(va);
                const nb = Number(vb);
                if (!isNaN(na) && !isNaN(nb)) return na > nb ? order : na < nb ? -order : 0;

                return va > vb ? order : va < vb ? -order : 0;
            });
        }

        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        const start = (page - 1) * pageSize;

        const pagedResults = sortedResults.slice(start, start + pageSize);
        const totalResults = sortedResults.length;
        const totalPages = Math.ceil(totalResults / pageSize);

        return { pagedResults, totalResults, totalPages };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
    }

    private async apiPost(path: string, data: any): Promise<AxiosResponse<any>> {
        return axios.post(`${this.fastApiUrl}${path}`, data);
    }

    private async apiGet(path: string, params: any): Promise<AxiosResponse<any>> {
        return axios.get(`${this.fastApiUrl}${path}`, { params });
    }

    private handleError(err: unknown, prefix = '操作失败'): ApiResponse<any> {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
        return ApiResponse.error(message);
    }

    private readonly ECON_SUMMARY_FIELD_MAP: Record<
        string,
        {
            displayName: string;
            pickFields: string[];
        }
    > = {
            '品位综合评价法': {
                displayName: '品位综合评价法',
                pickFields: [
                    '单品位价格折算后',
                    '折算后品位',
                ],
            },

            '单烧综合评价法': {
                displayName: '单烧综合评价法',
                pickFields: [
                    '烧结矿总成本',
                    '烧结矿单品位价',
                    '单烧后折算品位',
                    '烧结矿单品位价折算后'
                ],
            },

            '铁水成本评价法': {
                displayName: '铁水成本评价法',
                pickFields: [
                    '生铁成本',
                    '入炉品位',
                    '矿耗',
                ],
            },

            '基准矿粉对比评价法': {
                displayName: '基准矿粉对比评价法',
                pickFields: [
                    '与PB粉对比',
                ],
            },
        };
async buildSummaryFromTaskRefs(
  taskRefs: { taskUuid: string; name: string }[],
  query?: EconSummaryDto, // 包含分页/排序 + dataSourceType
): Promise<ApiResponse<any>> {
  try {
    const summaryMap: Record<string, any> = {};

    // 根据 dataSourceType 选择不同 Repo
    const repoMap = {
      ECON: this.rawRepo,
      SJ_RAW: this.sjRawRepo,
      PORT_IRON: this.portIronRepo,
    };
    const repo = repoMap[query?.dataSourceType || 'ECON'];

    for (const { taskUuid, name } of taskRefs) {
      const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
      if (!task) continue;

      const taskDef = this.ECON_TASKS.find(t => t.name === name);
      if (!taskDef) continue;

      const fieldConfig = this.ECON_SUMMARY_FIELD_MAP[name];
      if (!fieldConfig) continue;

      const res = await this.apiGet(taskDef.progressUrl, { taskUuid });
      const results = res.data?.data?.results || [];
      if (!results.length) continue;

      // 原料 ID → 名称映射
      const rawIdSet = new Set<number>();
      results.forEach(item => {
        const rawId = Number(item['原料']);
        if (!isNaN(rawId)) rawIdSet.add(rawId);
      });

      const raws = rawIdSet.size ? await repo.find({ where: { id: In([...rawIdSet]) } }) : [];
      const idNameMap: Record<number, string> = {};
      raws.forEach(raw => (idNameMap[raw.id] = raw.name));

      results.forEach(item => {
        const rawId = Number(item['原料']);
        const rawName = idNameMap[rawId] || item['原料'];

        if (!summaryMap[rawName]) summaryMap[rawName] = { 原料: rawName };

        fieldConfig.pickFields.forEach(field => {
          if (field in item) summaryMap[rawName][field] = item[field];
        });
      });
    }

    // 分页 + 排序
    return this.buildPagedSummary(summaryMap, query);
  } catch (err) {
    return this.handleError(err, '经济性评价汇总失败');
  }
}


private buildPagedSummary(
  summaryMap: Record<string, any>,
  pagination?: TaskProgressQueryDto,
) {
  let summaryList = Object.values(summaryMap);

  if (pagination?.sort) {
    const order = pagination.order === 'desc' ? -1 : 1;
    summaryList = summaryList.sort((a, b) => {
      const va = a[pagination.sort!];
      const vb = b[pagination.sort!];
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return na > nb ? order : na < nb ? -order : 0;
      return va > vb ? order : va < vb ? -order : 0;
    });
  }

  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 10;
  const start = (page - 1) * pageSize;

  return ApiResponse.success({
    results: summaryList.slice(start, start + pageSize),
    page,
    pageSize,
    totalResults: summaryList.length,
    totalPages: Math.ceil(summaryList.length / pageSize),
  });
}

async exportEconResult(
  taskUuid: string,
  dataSourceType: EconDataSourceType,
  pagination: TaskProgressQueryDto,
  res: Response
) {
  const result = await this.fetchEconProgress(
    taskUuid,
    dataSourceType,
    { ...pagination, page: 1, pageSize: 999999 }
  );

  const rows = result.data.results || [];

  if (!rows.length) {
    throw new Error('暂无数据可导出');
  }

  // ✅ 设置响应头（必须在创建 workbook 前）
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=econ_result_${taskUuid}.xlsx`
  );

  // ✅ 使用流式 Workbook
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
  });

  const worksheet = workbook.addWorksheet('经济性结果');

  const headers = Object.keys(rows[0]);

  worksheet.columns = headers.map(h => ({
    header: h,
    key: h,
    width: 18,
  }));

  // 加粗标题
  worksheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    worksheet.addRow(row).commit(); // ⚠️ 关键：commit
  }

  worksheet.commit();
  await workbook.commit(); // ⚠️ 必须 commit
}
}
