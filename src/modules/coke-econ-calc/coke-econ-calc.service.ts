import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import _ from 'lodash';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { CokeEconInfo } from '../coke-econ-info/entities/coke-econ-info.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { BizModule } from '../../database/entities/biz-module.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { CokeEconPaginationDto } from './dto/coke-econ-pagination.dto';
import { appConfig } from '../../config/app.config';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

@Injectable()
export class CokeEconCalcService {
    private readonly logger = new Logger(CokeEconCalcService.name);
    private readonly fastApiUrl = appConfig.api.fastApiUrl;

    private readonly ECON_TASKS = [
        {
            name: '焦炭成本性价比评价法',
            startUrl: '/cokeEcon1/start/',
            progressUrl: '/cokeEcon1/progress/',
            stopUrl: '/cokeEcon1/stop/',
        },
        {
            name: '焦炭质量评分法',
            startUrl: '/cokeEcon2/start/',
            progressUrl: '/cokeEcon2/progress/',
            stopUrl: '/cokeEcon2/stop/',
        },
    ];

    constructor(
        @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
        @InjectRepository(CokeEconInfo) private readonly rawRepo: Repository<CokeEconInfo>,
        @InjectRepository(ConfigGroup) private readonly configRepo: Repository<ConfigGroup>,
    ) { }

    /** 启动任务 */
    async startTasks(user: User, moduleName: string): Promise<ApiResponse<any>> {
        try {
            const group = await this.configRepo.findOne({
                where: { user: { user_id: user.user_id }, module: { name: moduleName }, is_latest: true },
            });
            if (!group) throw new Error(`模块 "${moduleName}" 没有参数组`);
            const configData = _.cloneDeep(group.config_data);
            const ingredientIds: number[] = configData.cokeParams || [];
            const raws = ingredientIds.length ? await this.rawRepo.findByIds(ingredientIds) : [];

            const cokeParams: Record<number, any> = {};
            raws.forEach(raw => {
                const comp = raw.composition || {};
                cokeParams[raw.id] = {
                    物料类别: comp['物料类别'] || '', // 字符串
                    C: Number(comp.C ?? 0),
                    CRI: Number(comp.CRI ?? 0),
                    CSR: Number(comp.CSR ?? 0),
                    M10: Number(comp.M10 ?? 0),
                    "M25/M40": Number(comp['M25/M40'] ?? 0),
                    S: Number(comp.S ?? 0),
                    内水: Number(comp['内水'] ?? 0),
                    含粉率: Number(comp['含粉率'] ?? 0),
                    挥发份: Number(comp['挥发份'] ?? 0),
                    水分: Number(comp['水分'] ?? 0),
                    灰分: Number(comp['灰分'] ?? 0),
                    焦炭含税到厂价: Number(comp['焦炭含税到厂价'] ?? 0),
                };
            });

            const fullParams = {
                cokeParams,
                cokeCostSet: configData.cokeCostSet || {},
                singleBurnSet: configData.singleBurnSet || {},
            };
            console.log('Full Params:', fullParams);

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

            return ApiResponse.success({ tasks, status: 'RUNNING' }, '焦炭经济性评价任务已启动');
        } catch (err: unknown) {
            return this.handleError(err, '启动任务失败');
        }
    }

    /** 停止任务 */
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

    /** 查询任务进度 */
    async fetchAndSaveProgress(
    taskUuid: string,
    pagination?: CokeEconPaginationDto
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

        // 3️⃣ 收集焦炭 ID
        const idSet = new Set<number>();
        (data.results || []).forEach(item => {
            const rawId = Number(item['焦炭名称']);
            if (!isNaN(rawId)) idSet.add(rawId);
        });

        // 4️⃣ 查询焦炭名称
        const raws = idSet.size
            ? await this.rawRepo.find({ where: { id: In([...idSet]) } })
            : [];
        const idNameMap: Record<number, string> = {};
        raws.forEach(raw => (idNameMap[raw.id] = raw.name));

        // 5️⃣ 替换焦炭名称
        let mappedResults = (data.results || []).map(item => {
            const rawId = Number(item['焦炭名称']);
            return { ...item, 焦炭名称: idNameMap[rawId] || item['焦炭名称'] };
        });

        // 6️⃣ ⚡ 性价比排名（根据“性价比指数”或“质量评分”）
        const rankFields = ['性价比指数', '质量评分'];
        const rankField = rankFields.find(f =>
            mappedResults.some(item => !isNaN(Number(item[f])))
        );

        if (rankField) {
            const resultsWithValue = mappedResults
                .filter(item => !isNaN(Number(item[rankField])))
                .sort((a, b) => Number(b[rankField]) - Number(a[rankField])); // 降序

            // 回写排名
            const rankMap = new Map<string, number>();
            resultsWithValue.forEach((item, index) => {
                rankMap.set(item['焦炭名称'], index + 1);
            });

            mappedResults = mappedResults.map(item => ({
                ...item,
                性价比排名: rankMap.get(item['焦炭名称']) ?? undefined
            }));
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
        return this.handleError(err, '获取任务进度失败');
    }
}


    /** 工具方法: 分页 + 排序 */
    private applyPaginationAndSort(results: any[], pagination?: CokeEconPaginationDto) {
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
    private readonly COKE_ECON_SUMMARY_FIELD_MAP: Record<
    string,
    {
        displayName: string;
        pickFields: string[];
    }
    > = {
    '焦炭成本性价比评价法': {
        displayName: '焦炭成本性价比评价法',
        pickFields: [
        '性价比指数',
        ],
    },
    '焦炭质量评分法': {
        displayName: '焦炭质量评分法',
        pickFields: [
        '质量评分'
        ],
    },
    };

async buildSummaryFromTaskRefs(
  taskRefs: { taskUuid: string; name: string }[],
  pagination?: CokeEconPaginationDto,
): Promise<ApiResponse<any>> {
  try {
    const summaryMap: Record<string, any> = {};

    for (const { taskUuid, name } of taskRefs) {
      const task = await this.taskRepo.findOne({
        where: { task_uuid: taskUuid },
      });
      if (!task) continue;

      const taskDef = this.ECON_TASKS.find(t => t.name === name);
      if (!taskDef) continue;

      const fieldConfig = this.COKE_ECON_SUMMARY_FIELD_MAP[name];
      if (!fieldConfig) continue;

      // 1️⃣ 拉 FastAPI 结果
      const res = await this.apiGet(taskDef.progressUrl, { taskUuid });
      const results = res.data?.data?.results || [];
      if (!results.length) continue;

      // 2️⃣ 焦炭 ID → 名称
      const idSet = new Set<number>();
      results.forEach(item => {
        const id = Number(item['焦炭名称']);
        if (!isNaN(id)) idSet.add(id);
      });

      const raws = idSet.size
        ? await this.rawRepo.find({ where: { id: In([...idSet]) } })
        : [];

      const idNameMap: Record<number, string> = {};
      raws.forEach(raw => (idNameMap[raw.id] = raw.name));

      // 3️⃣ 汇总字段
      results.forEach(item => {
        const id = Number(item['焦炭名称']);
        const nameKey = idNameMap[id] || item['焦炭名称'];

        if (!summaryMap[nameKey]) {
          summaryMap[nameKey] = { 焦炭名称: nameKey };
        }

        fieldConfig.pickFields.forEach(field => {
          if (field in item) {
            summaryMap[nameKey][field] = item[field];
          }
        });
      });
    }

    // 4️⃣ 排序
    let summaryList = Object.values(summaryMap);
    if (pagination?.sort) {
      const order = pagination.order === 'desc' ? -1 : 1;
      summaryList = summaryList.sort((a, b) => {
        const va = a[pagination.sort!];
        const vb = b[pagination.sort!];
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) {
          return na > nb ? order : na < nb ? -order : 0;
        }
        return va > vb ? order : va < vb ? -order : 0;
      });
    }

    // 5️⃣ 分页
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 10;
    const start = (page - 1) * pageSize;
    const pagedResults = summaryList.slice(start, start + pageSize);

    return ApiResponse.success(
      {
        results: pagedResults,
        page,
        pageSize,
        totalResults: summaryList.length,
        totalPages: Math.ceil(summaryList.length / pageSize),
      },
      '焦炭经济性评价汇总完成',
    );
  } catch (err) {
    return this.handleError(err, '焦炭经济性评价汇总失败');
  }
}

async exportTaskResult(
  taskUuid: string,
  pagination: CokeEconPaginationDto,
  res: Response
) {
  try {
    // 1️⃣ 强制全量，但保留排序参数
    const fullQuery: CokeEconPaginationDto = {
      ...pagination,
      page: 1,
      pageSize: Number.MAX_SAFE_INTEGER,
    };

    const result = await this.fetchAndSaveProgress(taskUuid, fullQuery);

    const rows = result.data?.results ?? [];

    if (!rows.length) {
      throw new Error('暂无数据可导出');
    }

    // 2️⃣ 设置响应头
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const fileName = `焦炭经济性结果_${taskUuid}.xlsx`;

    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );

    // 3️⃣ 创建流式 Workbook
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true,
    });

    const worksheet = workbook.addWorksheet('经济性结果');

    const headers = Object.keys(rows[0]);
    worksheet.columns = headers.map(h => ({
      header: h,
      key: h,
      width: 18,
    }));

    worksheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      worksheet.addRow(row).commit();
    }

    worksheet.commit();
    await workbook.commit();

  } catch (err) {
    throw new Error('导出失败：' + err.message);
  }
}

}
