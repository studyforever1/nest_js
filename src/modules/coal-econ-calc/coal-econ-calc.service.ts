import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import _ from 'lodash';
import { Task, TaskStatus } from '../../database/entities/task.entity';
import { User } from '../user/entities/user.entity';
import { CoalEconInfo } from '../coal-econ-info/entities/coal-econ-info.entity';
import { ConfigGroup } from '../../database/entities/config-group.entity';
import { ApiResponse } from '../../common/response/response.dto';
import { CoalEconPaginationDto } from './dto/coal-econ-calc.dto';

@Injectable()
export class CoalEconCalcService {
  private readonly logger = new Logger(CoalEconCalcService.name);
  private readonly fastApiUrl = process.env.FASTAPI_URL;

  private readonly ECON_TASK = {
    name: '喷吹煤经济性评价',
    startUrl: '/coalEcon1/start/',
    progressUrl: '/coalEcon1/progress/',
    stopUrl: '/coalEcon1/stop/',
  };

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(CoalEconInfo) private readonly coalRepo: Repository<CoalEconInfo>,
    @InjectRepository(ConfigGroup) private readonly configRepo: Repository<ConfigGroup>,
  ) {}

  /** 启动任务 */
async startTask(
  user: User,
  moduleName: string,
): Promise<ApiResponse<{ taskUuid: string; status: string }>> {
  try {
    const group = await this.configRepo.findOne({
      where: {
        user: { user_id: user.user_id },
        module: { name: moduleName },
        is_latest: true,
      },
    });
    if (!group) throw new Error(`模块 "${moduleName}" 没有参数组`);

    const configData = _.cloneDeep(group.config_data);

    /** 1️⃣ 读取选中的喷吹煤 ID */
    const coalIds: number[] = configData.coalParams || [];
    const coals = coalIds.length
      ? await this.coalRepo.findByIds(coalIds)
      : [];

    /** 2️⃣ 构建喷吹煤参数（ID → 业务字段） */
    const coalParams: Record<number, any> = {};
    coals.forEach(c => {
      const comp = c.composition || {};
      coalParams[c.id] = {
        物料类别: comp.物料类别 ?? '',
        挥发份: Number(comp.挥发份 ?? 0),
        S: Number(comp.S ?? 0),
        C: Number(comp.C ?? 0),
        内水: Number(comp.内水 ?? 0),
        灰分: Number(comp.灰分 ?? 0),
        H2O: Number(comp.H2O ?? 0),
        哈氏可磨: Number(comp.哈氏可磨 ?? 0),
        运费: Number(comp.运费 ?? 0),
        发热量_检测值: Number(comp.发热量_检测值 ?? 0),
        干基不含税到厂价: Number(comp.干基不含税到厂价 ?? 0),
        含税_含水_含粉合同价: Number(comp.含税_含水_含粉合同价 ?? 0),
      };
    });

    /** 3️⃣ 组合完整参数 */
    const fullParams = {
      coalParams,
      coalCostSet: configData.coalCostSet || {},
    };

    /** 4️⃣ 打印校验 */
    console.log('启动喷吹煤任务参数:', JSON.stringify(fullParams, null, 2));

    /** 5️⃣ 调用 FastAPI */
    const res: AxiosResponse<any> = await this.apiPost(
      this.ECON_TASK.startUrl,
      fullParams,
    );

    const taskUuid = res.data?.data?.taskUuid;
    if (!taskUuid) throw new Error('任务启动失败，未返回 taskUuid');

    /** 6️⃣ 保存任务记录 */
    const task = this.taskRepo.create({
      task_uuid: taskUuid,
      module_type: this.ECON_TASK.name,
      status: TaskStatus.RUNNING,
      parameters: fullParams,
      user,
    });
    await this.taskRepo.save(task);

    return ApiResponse.success(
      { taskUuid, status: 'RUNNING' },
      '喷吹煤经济性任务已启动',
    );
  } catch (err) {
    return this.handleError(err, '启动任务失败');
  }
}


  /** 停止任务 */
  async stopTask(taskUuid: string): Promise<ApiResponse<any>> {
    try {
      await this.apiPost(this.ECON_TASK.stopUrl, { taskUuid });

      const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
      if (task) {
        task.status = TaskStatus.STOPPED;
        await this.taskRepo.save(task);
      }

      return ApiResponse.success({ taskUuid, status: 'STOPPED' }, '任务已停止');
    } catch (err) {
      return this.handleError(err, '停止任务失败');
    }
  }

  /** 查询进度 + ID 转名称 + 分页 */
  async fetchAndSaveProgress(
    taskUuid: string,
    pagination?: CoalEconPaginationDto,
  ): Promise<ApiResponse<any>> {
    try {
      const task = await this.taskRepo.findOne({ where: { task_uuid: taskUuid } });
      if (!task) return ApiResponse.error('任务不存在');

      const res = await this.apiGet(this.ECON_TASK.progressUrl, { taskUuid });
      const data = res.data?.data;
      if (!data) return ApiResponse.success({ status: 'RUNNING', results: [] });

      /** ---------- 提取喷吹煤标识 ---------- */
      const identifiers = new Set<string>();
      (data.results || []).forEach(item => {
        const idOrName = item['喷吹煤名称'];
        if (idOrName) identifiers.add(String(idOrName));
      });

      /** ---------- 查询数据库 ---------- */
      let coals: CoalEconInfo[] = [];
      if (identifiers.size) {
        const numericIds = [...identifiers].map(v => Number(v)).filter(v => !isNaN(v));
        if (numericIds.length) {
          coals = await this.coalRepo.find({ where: { id: In(numericIds) } });
        }

        const nameStrings = [...identifiers].filter(v => isNaN(Number(v)));
        if (nameStrings.length) {
          const byName = await this.coalRepo.find({ where: { name: In(nameStrings) } });
          coals = coals.concat(byName);
        }
      }

      /** ---------- 构建映射 ---------- */
      const nameMap: Record<string, string> = {};
      coals.forEach(c => {
        nameMap[c.id] = c.name;
        nameMap[c.name] = c.name;
      });

      /** ---------- 映射结果 ---------- */
      const mappedResults = (data.results || []).map(item => ({
        ...item,
        喷吹煤名称: nameMap[item['喷吹煤名称']] || item['喷吹煤名称'],
      }));

      /** ---------- 分页 ---------- */
      const page = Number(pagination?.page ?? 1);
      const pageSize = Number(pagination?.pageSize ?? 10);
      const start = (page - 1) * pageSize;

      const pagedResults = mappedResults.slice(start, start + pageSize);

      return ApiResponse.success({
        taskUuid,
        status: data.status,
        progress: data.progress ?? 0,
        total: data.total ?? mappedResults.length,
        results: pagedResults,
        page,
        pageSize,
        totalResults: mappedResults.length,
        totalPages: Math.ceil(mappedResults.length / pageSize),
      });
    } catch (err) {
      return this.handleError(err, '获取任务进度失败');
    }
  }

  private async apiPost(path: string, data: any) {
    return axios.post(`${this.fastApiUrl}${path}`, data);
  }

  private async apiGet(path: string, params: any) {
    return axios.get(`${this.fastApiUrl}${path}`, { params });
  }

  private handleError(err: unknown, prefix = '操作失败') {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`${prefix}: ${message}`, (err as any)?.stack);
    return ApiResponse.error(message);
  }
}
