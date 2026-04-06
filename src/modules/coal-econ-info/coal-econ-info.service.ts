import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';
import { CoalEconInfo } from './entities/coal-econ-info.entity';
import { CreateCoalEconInfoDto } from './dto/create-coal-econ-info.dto';
import { UpdateCoalEconInfoDto } from './dto/update-coal-econ-info.dto';
import { ConfigGroup } from 'src/database/entities/config-group.entity';
import { User } from '../user/entities/user.entity';

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 根据数据库实际数据提取的composition字段
 */
export const FIXED_HEADERS = [
  'C', 'S', 'H2O', '内水', '灰分', '运费', '挥发份', '哈氏可磨',
  '物料类别', '发热量_检测值', '干基不含税到厂价', '含税_含水_含粉合同价',
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

/** 排序字段映射 */
const SORT_FIELD_MAP: Record<string, string> = {
  // 普通字段
  name: 'c.name',
  created_at: 'c.created_at',
  // JSON 字段
  'composition.干基不含税到厂价': "JSON_EXTRACT(c.composition, '$.干基不含税到厂价')",
};

@Injectable()
export class CoalEconInfoService {
  private readonly SORT_FIELD_MAP = SORT_FIELD_MAP;

  constructor(
    @InjectRepository(CoalEconInfo)
    private readonly repo: Repository<CoalEconInfo>,
  ) {}

  /** =========================
   *  核心：规范化 composition
   * ========================= */
  private normalizeComposition(
    composition?: Record<string, number>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    FIXED_HEADERS.forEach((key) => {
      result[key] = composition?.[key] ?? 0;
    });
    return result;
  }

  private cellToString(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      if ('text' in value && value.text !== undefined) return String(value.text).trim();
      if ('result' in value && value.result !== undefined) return String(value.result).trim();
      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((item: any) => item?.text ?? '').join('').trim();
      }
      if ('formula' in value && value.formula !== undefined) return String(value.formula).trim();
    }
    return String(value).trim();
  }

  private parseNumericCellOrThrow(rawText: string, rowIndex: number, header: string): number | undefined {
    if (!rawText) return undefined;
    const val = Number(rawText);
    if (!Number.isFinite(val)) {
      throw new BadRequestException(`第 ${rowIndex} 行 [${header}] 必须为数字`);
    }
    return val;
  }

  /** ========================= 创建 ========================= */
  async create(dto: CreateCoalEconInfoDto, username: string) {
    return this.repo.save(
      this.repo.create({
        ...dto,
        composition: this.normalizeComposition(dto.composition),
        modifier: username,
        enabled: true,
      }),
    );
  }

  /** ========================= 更新 ========================= */
  async update(id: number, dto: UpdateCoalEconInfoDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('数据不存在');
    Object.assign(entity, dto, {
      composition: dto.composition ? this.normalizeComposition(dto.composition) : entity.composition,
      modifier: username,
    });
    return this.repo.save(entity);
  }
private readonly MODULE_NAME = '喷吹煤经济性评价';
  /** ========================= 查询（核心修改点） ========================= */
async query(options: {
  user: User;
  page: number;
  pageSize: number;
  name?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const { user, page, pageSize, name, sort, order } = options;

  const qb = this.repo.createQueryBuilder('c');

  // ================= 1️⃣ 名称模糊 =================
  if (name) {
    qb.andWhere('c.name LIKE :name', { name: `%${name}%` });
  }

  // ================= 2️⃣ 排序 =================
  if (sort) {
    if (sort.startsWith('composition.')) {
      const key = sort.replace('composition.', '');

      qb.orderBy(
        `CAST(JSON_EXTRACT(c.composition, '$."${key}"') AS DECIMAL)`,
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else if (this.SORT_FIELD_MAP[sort]) {
      qb.orderBy(
        this.SORT_FIELD_MAP[sort],
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else {
      qb.orderBy('c.id', 'ASC');
    }
  } else {
    qb.orderBy('c.id', 'ASC');
  }

  // ❗ 不在 SQL 里分页
  const records = await qb.getMany();
  const total = records.length;

  // ================= 3️⃣ 获取已选原料 =================
  let selectedSet = new Set<number>();

  try {
    const configRepo = this.repo.manager.getRepository(ConfigGroup);

    const config = await configRepo
      .createQueryBuilder('cg')
      .leftJoin('cg.user', 'user')
      .leftJoin('cg.module', 'module')
      .where('user.user_id = :userId', { userId: user.user_id })
      .andWhere('module.name = :moduleName', {
        moduleName: this.MODULE_NAME,
      })
      .orderBy('cg.updated_at', 'DESC')
      .getOne();

    if (config?.config_data) {
      const configData =
        typeof config.config_data === 'string'
          ? JSON.parse(config.config_data)
          : config.config_data;

      const coalParams: number[] = configData.coalParams ?? [];

      if (coalParams.length) {
        selectedSet = new Set(coalParams.map(id => Number(id)));
      }
    }
  } catch (err) {
    console.warn('获取模块配置失败，不影响查询', err);
  }

  // ================= 4️⃣ 映射 =================
  const mapped = records
    .map(item => ({
      ...item,
      composition: this.normalizeComposition(item.composition),
      selected: selectedSet.has(Number(item.id)),
    }))
    .sort((a, b) => {
      if (a.selected && !b.selected) return -1;
      if (!a.selected && b.selected) return 1;
      return 0;
    });

  // ================= 5️⃣ 内存分页 =================
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paged = mapped.slice(start, end);

  return {
    data: paged,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}


  async remove(ids: number[]) {
    if (!ids?.length) throw new Error('未提供删除 ID');
    const list = await this.repo.findBy({ id: In(ids) });
    if (!list.length) throw new NotFoundException(`ID ${ids.join(',')} 不存在`);
    return this.repo.remove(list);
  }

  async removeAll(username: string) {
    const list = await this.repo.find();
    if (!list.length) return { status: 'error', message: '煤炭经济性库为空' };
    list.forEach(i => (i.modifier = username));
    await this.repo.remove(list);
    return { status: 'success', message: `成功删除 ${list.length} 条记录` };
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
    const list = await this.repo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('喷吹煤信息库');

    sheet.addRow(['喷吹煤名称', ...FIXED_HEADERS]);

    list.forEach(item => {
      const composition = this.normalizeComposition(item.composition);
      sheet.addRow([
        item.name,
        ...FIXED_HEADERS.map(h => composition[h]),
      ]);
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** ========================= 导入 Excel ========================= */
  async importExcel(file: Express.Multer.File, username: string) {
    if (!file?.buffer) throw new BadRequestException('文件为空');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel 中没有工作表');

    const headerRow = sheet.getRow(1);
    const headerMap: Record<string, number> = {};

    headerRow.eachCell((cell, col) => {
      const val = String(cell.value ?? '').trim();
      if (!val) return;
      if (!FIXED_HEADERS.includes(val as FixedHeader) && val !== '喷吹煤名称') {
        throw new BadRequestException(`非法列名：${val}`);
      }
      headerMap[val] = col;
    });

    if (!headerMap['喷吹煤名称']) {
      throw new BadRequestException('缺少必要列：喷吹煤名称');
    }

    const result: CoalEconInfo[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = String(row.getCell(headerMap['喷吹煤名称'])?.value ?? '').trim();
      if (!name) return;

      const composition: Record<string, number> = {};

      FIXED_HEADERS.forEach(key => {
        const col = headerMap[key];
        const val = col ? parseFloat(String(row.getCell(col)?.value ?? '')) : 0;
        composition[key] = Number.isFinite(val) ? val : 0;
      });

      result.push(this.repo.create({
        name,
        composition,
        modifier: username,
        enabled: true,
      }));
    });

    if (!result.length) {
      return { status: 'error', message: '没有有效数据可导入' };
    }

    await this.repo.save(result);
    return { status: 'success', message: `成功导入 ${result.length} 条数据` };
  }

  /** ========================= 批量修改（按物料名称更新已有数据） ========================= */
  async importExcelBatchUpdate(file: Express.Multer.File, username: string) {
    if (!file?.buffer) throw new BadRequestException('文件为空');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel 中没有工作表');

    const keyHeader = '喷吹煤名称';

    const headerRow = sheet.getRow(1);
    const headerMap: Record<string, number> = {};

    headerRow.eachCell((cell, col) => {
      const val = this.cellToString(cell.value);
      if (!val) return;
      // 批量修改：允许用户添加额外列，未知列忽略
      if (val === keyHeader || (FIXED_HEADERS as string[]).includes(val)) {
        headerMap[val] = col;
      }
    });

    if (!headerMap[keyHeader]) {
      throw new BadRequestException(`缺少必要列：${keyHeader}`);
    }

    const rowPayloads: Array<{
      name: string;
      updates: Record<string, number>;
    }> = [];
    const names = new Set<string>();

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = this.cellToString(row.getCell(headerMap[keyHeader]).value);
      if (!name) return;

      names.add(name);

      const updates: Record<string, number> = {};
      FIXED_HEADERS.forEach((key) => {
        const col = headerMap[key];
        if (!col) return;
        const raw = this.cellToString(row.getCell(col).value);
        const num = this.parseNumericCellOrThrow(raw, index, key);
        if (num !== undefined) updates[key] = num;
      });

      rowPayloads.push({ name, updates });
    });

    if (!rowPayloads.length) {
      return { status: 'error', message: '没有有效数据可导入（缺少喷吹煤名称）' };
    }

    const existedRows = await this.repo.find({ where: { name: In(Array.from(names)) } });
    const existedByName = new Map(existedRows.map((item) => [item.name, item]));

    const updates: CoalEconInfo[] = [];
    let skipped = 0;
    let skippedNoChange = 0;

    rowPayloads.forEach((row) => {
      const target = existedByName.get(row.name);
      if (!target) {
        skipped += 1;
        return;
      }

      const hasAnyField = Object.keys(row.updates).length > 0;
      if (!hasAnyField) {
        skippedNoChange += 1;
        return;
      }

      target.composition = this.normalizeComposition({
        ...(target.composition ?? {}),
        ...row.updates,
      });
      target.modifier = username;
      updates.push(target);
    });

    if (!updates.length) {
      return { status: 'error', message: `未匹配到可更新数据，已跳过 ${skipped} 条未匹配物料、${skippedNoChange} 条无更新字段` };
    }

    await this.repo.save(updates);
    return { status: 'success', message: `成功更新 ${updates.length} 条数据，跳过 ${skipped} 条未匹配物料、${skippedNoChange} 条无更新字段` };
  }

  /** ========================= 模板 ========================= */
  private readonly templateDir = process.env.TEMPLATE_PATH || './templates';
  private readonly templateFilename = 'coal-econ-info-template.xlsx';
  private readonly batchUpdateTemplateFilename = 'coal-econ-info-batch-update-template.xlsx';

  private async ensureTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.templateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('模板').addRow(['喷吹煤名称', ...FIXED_HEADERS]);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getTemplateFilePath(): Promise<string> {
    return this.ensureTemplateFileExists();
  }

  /** ========================= 批量修改模板 ========================= */
  private async ensureBatchUpdateTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.batchUpdateTemplateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('模板');
    sheet.addRow(['喷吹煤名称', ...FIXED_HEADERS]);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getBatchUpdateTemplateFilePath(): Promise<string> {
    return this.ensureBatchUpdateTemplateFileExists();
  }
}
