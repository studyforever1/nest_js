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
import { SJEconPaginationDto } from './dto/coke-econ-pagination.dto';

@Injectable()
export class CokeEconCalcService {
    private readonly logger = new Logger(CokeEconCalcService.name);
    private readonly fastApiUrl = process.env.FASTAPI_URL;

    private readonly ECON_TASKS = [
        {
            name: '焦炭性价比评价法',
            startUrl: '/cokeEcon1/start/',
            progressUrl: '/cokeEcon1/progress/',
            stopUrl: '/cokeEcon1/stop/',
        },
        {
            name: '单烧综合评价法',
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
    async fetchAndSaveProgress(taskUuid: string, pagination?: SJEconPaginationDto): Promise<ApiResponse<any>> {
        try {
            const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
            if (!task) return ApiResponse.error('任务不存在');

            const taskDef = this.ECON_TASKS.find(t => t.name === task.module_type);
            if (!taskDef) return ApiResponse.error('任务定义不存在');

            const res = await this.apiGet(taskDef.progressUrl, { taskUuid });
            const data = res.data?.data;
            if (!data) return ApiResponse.success({ status: 'RUNNING', results: [] });

            const idSet = new Set<number>();
            (data.results || []).forEach(item => {
                const rawId = Number(item['焦炭名称']);
                if (!isNaN(rawId)) idSet.add(rawId);
            });

            const raws = idSet.size ? await this.rawRepo.find({ where: { id: In([...idSet]) } }) : [];
            const idNameMap: Record<number, string> = {};
            raws.forEach(raw => (idNameMap[raw.id] = raw.name));

            const mappedResults = (data.results || []).map(item => {
                const rawId = Number(item['焦炭名称']);
                return { ...item, 焦炭名称: idNameMap[rawId] || item['焦炭名称'] };
            });

            const { pagedResults, totalResults, totalPages } = this.applyPaginationAndSort(mappedResults, pagination);

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
    private applyPaginationAndSort(results: any[], pagination?: SJEconPaginationDto) {
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
}
