import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { Express } from 'express';

import { FinesHtBaseProp } from './entities/fines-ht-base-prop.entity';
import { CreateFinesHtBasePropDto } from './dto/create-fines-ht-base-prop.dto';
import { UpdateFinesHtBasePropDto } from './dto/update-fines-ht-base-prop.dto';

const SORT_FIELD_MAP: Record<string, string> = {
  name: 'f.name',
  created_at: 'f.created_at',
  'composition.TFe': "JSON_EXTRACT(f.composition, '$.TFe')",
};

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 注意：composition 中不包含"矿粉名称"
 */
export const FIXED_HEADERS = [
  '矿粉名称','同化性', '碱度4_0液相流动性指数/1250度', '碱度4_0液相流动性指数/1270度', '碱度4_0液相流动性指数/1290度',
   '碱度2_0粘结相强度', '连晶强度N', 'TFe','SiO2', 'CaO', 'MnO', 'Al2O3',
  'MnO', 'P','S', 'TiO2', 'K2O', 'Na2O', 'Zn', 'FeO',
  'LOI', '高温特性评价'
];

type FixedHeader = (typeof FIXED_HEADERS)[number];


@Injectable()
export class FinesHtBasePropService {
  constructor(
    @InjectRepository(FinesHtBaseProp)
    private readonly repo: Repository<FinesHtBaseProp>,
  ) {}

  /** =========================
   *  核心：规范化 composition（按 FIXED_HEADERS 顺序，排除"矿粉名称"）
   * ========================= */
  private normalizeComposition(
    composition?: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    FIXED_HEADERS.forEach((key) => {
      if (key === '矿粉名称') return; // 排除"矿粉名称"
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
  async create(dto: CreateFinesHtBasePropDto, username: string) {
    const entity = this.repo.create({
      ...dto,
      composition: this.normalizeComposition(dto.composition),
      modifier: username,
      enabled: true,
    });
    return this.repo.save(entity);
  }

  /** ========================= 更新 ========================= */
  async update(id: number, dto: UpdateFinesHtBasePropDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`ID ${id} 不存在`);

    Object.assign(entity, {
      ...dto,
      composition: dto.composition ? this.normalizeComposition(dto.composition) : entity.composition,
      modifier: username,
    });

    return this.repo.save(entity);
  }

  /** ========================= 查询（核心修改点） ========================= */
async query(options: {
  page?: number;
  pageSize?: number;
  name?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const { page = 1, pageSize = 10, name, sort, order } = options;

  const qb = this.repo.createQueryBuilder('f');

  // ================= 1️⃣ 名称模糊 =================
  if (name) {
    qb.andWhere('f.name LIKE :name', { name: `%${name}%` });
  }

  // ================= 2️⃣ 排序 =================
  if (sort) {
    if (sort.startsWith('composition.')) {
      // 排序字段在 composition JSON 内
      const key = sort.replace('composition.', '');
      qb.orderBy(
        `CAST(JSON_EXTRACT(f.composition, '$."${key}"') AS DECIMAL)`,
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else if (SORT_FIELD_MAP[sort]) {
      // 普通字段排序
      qb.orderBy(
        SORT_FIELD_MAP[sort],
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else {
      // fallback 默认排序
      qb.orderBy('f.id', 'ASC');
    }
  } else {
    qb.orderBy('f.id', 'ASC');
  }

  // ================= 3️⃣ 分页 =================
  qb.skip((page - 1) * pageSize).take(pageSize);

  const [list, total] = await qb.getManyAndCount();

  // ================= 4️⃣ 格式化 composition =================
  const mapped = list.map(item => ({
    ...item,
    composition: this.normalizeComposition(item.composition),
  }));

  return {
    data: mapped,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}


  async remove(ids: number[]) {
    const list = await this.repo.findBy({ id: In(ids) });
    if (!list.length) throw new NotFoundException('数据不存在');
    return this.repo.remove(list);
  }

  async removeAll(username: string) {
    const list = await this.repo.find();
    list.forEach(i => (i.modifier = username));
    await this.repo.remove(list);
    return { message: `已清空 ${list.length} 条数据` };
  }

  /** ========================= 导出 Excel ========================= */
async exportExcel(): Promise<Buffer> {
  const list = await this.repo.find();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('铁矿粉高温基础特性');

  // 添加表头
  sheet.addRow(FIXED_HEADERS);

  // 数值列
  const NUMERIC_COLUMNS = [
    '同化性', '碱度4_0液相流动性指数/1250度', '碱度4_0液相流动性指数/1270度', '碱度4_0液相流动性指数/1290度',
    '碱度2_0粘结相强度', '连晶强度N', 'TFe','SiO2', 'CaO', 'MnO', 'Al2O3',
    'MnO', 'P','S', 'TiO2', 'K2O', 'Na2O', 'Zn', 'FeO', 'LOI'
  ];

  list.forEach(item => {
    const composition = this.normalizeComposition(item.composition);

    const rowValues = FIXED_HEADERS.map((key, idx) => {
      if (key === '矿粉名称') return item.name;

      if (NUMERIC_COLUMNS.includes(key)) {
        const val = composition[key];
        return Number.isFinite(val) ? Number(val) : 0; // 数字列保持数字
      } else {
        const val = composition[key];
        return val != null ? String(val) : ''; // 文本列保持字符串
      }
    });

    sheet.addRow(rowValues);
  });

  // 可选：设置列宽，便于查看
  sheet.columns.forEach(col => {
    col.width = 15;
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
    if (!FIXED_HEADERS.includes(val as FixedHeader)) {
      throw new BadRequestException(`非法列名：${val}`);
    }
    headerMap[val] = col;
  });

  if (!headerMap['矿粉名称']) {
    throw new BadRequestException('缺少必要列：矿粉名称');
  }

  const result: FinesHtBaseProp[] = [];

  // ✅ 数值列，其他列均按文本处理
  const NUMERIC_COLUMNS = [
    '同化性', '碱度4_0液相流动性指数/1250度', '碱度4_0液相流动性指数/1270度', '碱度4_0液相流动性指数/1290度',
    '碱度2_0粘结相强度', '连晶强度N', 'TFe','SiO2', 'CaO', 'MnO', 'Al2O3',
    'MnO', 'P','S', 'TiO2', 'K2O', 'Na2O', 'Zn', 'FeO', 'LOI'
  ];

  sheet.eachRow({ includeEmpty: true }, (row, index) => {
    if (index === 1) return;

    const name = String(row.getCell(headerMap['矿粉名称'])?.value ?? '').trim();
    if (!name) return;

    const composition: Record<string, any> = {};

    FIXED_HEADERS.forEach(key => {
      if (key === '矿粉名称') return;

      const col = headerMap[key];
      const val = col ? row.getCell(col)?.value : null;

      if (NUMERIC_COLUMNS.includes(key)) {
        const num = Number(val);
        composition[key] = Number.isFinite(num) ? num : 0;
      } else {
        // 文本列，保留原始字符
        composition[key] = val != null ? String(val).trim() : '';
      }
    });

    result.push(this.repo.create({
      name,
      composition: this.normalizeComposition(composition),
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

    const keyHeader = '矿粉名称';

    const headerRow = sheet.getRow(1);
    const headerMap: Record<string, number> = {};

    headerRow.eachCell((cell, col) => {
      const val = this.cellToString(cell.value);
      if (!val) return;
      // 批量修改：允许用户添加额外列，未知列忽略
      if ((FIXED_HEADERS as string[]).includes(val)) headerMap[val] = col;
    });

    if (!headerMap[keyHeader]) {
      throw new BadRequestException(`缺少必要列：${keyHeader}`);
    }

    const NUMERIC_COLUMNS = [
      '同化性', '碱度4_0液相流动性指数/1250度', '碱度4_0液相流动性指数/1270度', '碱度4_0液相流动性指数/1290度',
      '碱度2_0粘结相强度', '连晶强度N', 'TFe', 'SiO2', 'CaO', 'MnO', 'Al2O3',
      'MnO', 'P', 'S', 'TiO2', 'K2O', 'Na2O', 'Zn', 'FeO', 'LOI',
    ];

    const rowPayloads: Array<{ name: string; updates: Record<string, any> }> = [];
    const names = new Set<string>();

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = this.cellToString(row.getCell(headerMap[keyHeader]).value);
      if (!name) return;
      names.add(name);

      const updates: Record<string, any> = {};
      FIXED_HEADERS.forEach((key) => {
        if (key === keyHeader) return;
        const col = headerMap[key];
        if (!col) return;
        const raw = this.cellToString(row.getCell(col).value);
        if (!raw) return; // 空单元格不覆盖

        if (NUMERIC_COLUMNS.includes(key)) {
          const num = this.parseNumericCellOrThrow(raw, index, key);
          if (num !== undefined) updates[key] = num;
        } else {
          updates[key] = raw;
        }
      });

      rowPayloads.push({ name, updates });
    });

    if (!rowPayloads.length) {
      return { status: 'error', message: '没有有效数据可导入（缺少矿粉名称）' };
    }

    const existedRows = await this.repo.find({ where: { name: In(Array.from(names)) } });
    const existedByName = new Map(existedRows.map((item) => [item.name, item]));

    const updates: FinesHtBaseProp[] = [];
    let skipped = 0;
    let skippedNoChange = 0;

    rowPayloads.forEach((row) => {
      const target = existedByName.get(row.name);
      if (!target) {
        skipped += 1;
        return;
      }

      if (Object.keys(row.updates).length === 0) {
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
  private readonly templateFilename = 'fines-ht-base-prop-template.xlsx';
  private readonly batchUpdateTemplateFilename = 'fines-ht-base-prop-batch-update-template.xlsx';

  private async ensureTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.templateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('模板').addRow(FIXED_HEADERS);
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
    workbook.addWorksheet('模板').addRow(FIXED_HEADERS);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getBatchUpdateTemplateFilePath(): Promise<string> {
    return this.ensureBatchUpdateTemplateFileExists();
  }
}
