import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { Express } from 'express';

import { MineTypInd } from './entities/mine-typ-ind.entity';
import { CreateMineTypIndDto } from './dto/create-mine-typ-ind.dto';
import { UpdateMineTypIndDto } from './dto/update-mine-typ-ind.dto';

const SORT_FIELD_MAP: Record<string, string> = {
  name: 'm.name',
  created_at: 'm.created_at',
  'composition.TFe': "JSON_EXTRACT(m.composition, '$.TFe')",
};

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 注意：composition 中不包含"矿粉名称"
 */
export const FIXED_HEADERS = [
  '矿粉名称','产地及矿山','指标','Fe','SiO2','Al2O3','P','S','H2O','CaO','MgO',
  'Mn','K2O','Na2O','LOI','粒度','产量'
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

@Injectable()
export class MineTypIndService {
  constructor(
    @InjectRepository(MineTypInd)
    private readonly repo: Repository<MineTypInd>,
  ) {}

  /** ========================= 核心：规范化 composition ========================= */
  private normalizeComposition(
    composition?: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};
    FIXED_HEADERS.forEach((key) => {
      if (key === '矿粉名称') return;
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
  async create(dto: CreateMineTypIndDto, username: string) {
    const entity = this.repo.create({
      ...dto,
      composition: this.normalizeComposition(dto.composition),
      modifier: username,
      enabled: true,
    });
    return this.repo.save(entity);
  }

  /** ========================= 更新 ========================= */
  async update(id: number, dto: UpdateMineTypIndDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`ID ${id} 不存在`);

    Object.assign(entity, {
      ...dto,
      composition: dto.composition ? this.normalizeComposition(dto.composition) : entity.composition,
      modifier: username,
    });
    return this.repo.save(entity);
  }

  /** ========================= 查询 ========================= */
async query(options: {
  page?: number;
  pageSize?: number;
  name?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const { page = 1, pageSize = 10, name, sort, order } = options;

  const qb = this.repo.createQueryBuilder('m');

  // ================= 1️⃣ 名称模糊 =================
  if (name) {
    qb.andWhere('m.name LIKE :name', { name: `%${name}%` });
  }

  // ================= 2️⃣ 排序 =================
  if (sort) {
    if (sort.startsWith('composition.')) {
      // 排序字段在 composition JSON 内
      const key = sort.replace('composition.', '');
      qb.orderBy(
        `CAST(JSON_EXTRACT(m.composition, '$."${key}"') AS DECIMAL)`,
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
      qb.orderBy('m.id', 'ASC');
    }
  } else {
    qb.orderBy('m.id', 'ASC');
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


  /** ========================= 删除 ========================= */
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
    const sheet = workbook.addWorksheet('主要矿山典型指标');

    // ✅ 按 FIXED_HEADERS 顺序导出
    sheet.addRow(FIXED_HEADERS);

    list.forEach(item => {
      const composition = this.normalizeComposition(item.composition);

      sheet.addRow([
        item.name,
        ...FIXED_HEADERS
          .filter(h => h !== '矿粉名称')
          .map(h => composition[h]),
      ]);
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** ========================= 导入 Excel（支持汉字） ========================= */
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

    const result: MineTypInd[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const nameCell = row.getCell(headerMap['矿粉名称']);
      const name = nameCell?.value ? String(nameCell.value).trim() : '';
      if (!name) return;

      const composition: Record<string, any> = {};

      FIXED_HEADERS.forEach(key => {
        if (key === '矿粉名称') return;

        const col = headerMap[key];
        const cell = col ? row.getCell(col) : undefined;
        const val = cell?.value;

        // 数字列
        if (['Fe','SiO2','Al2O3','P','S','H2O','CaO','MgO','Mn','K2O','Na2O','LOI'].includes(key)) {
          const num = Number(val);
          composition[key] = Number.isFinite(num) ? num : 0;
        } else {
          // 文本列（可以是汉字）
          composition[key] = val != null ? String(val) : '';
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

    const NUMERIC_COLUMNS = ['Fe', 'SiO2', 'Al2O3', 'P', 'S', 'H2O', 'CaO', 'MgO', 'Mn', 'K2O', 'Na2O', 'LOI'];

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
        if (!raw) return;

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

    const updates: MineTypInd[] = [];
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
  private readonly templateFilename = 'mine-typ-ind-template.xlsx';
  private readonly batchUpdateTemplateFilename = 'mine-typ-ind-batch-update-template.xlsx';

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
