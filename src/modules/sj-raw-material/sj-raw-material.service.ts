import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { SjRawMaterial } from './entities/sj-raw-material.entity';
import { CreateSjRawMaterialDto } from './dto/create-sj-raw-material.dto';
import { UpdateSjRawMaterialDto } from './dto/update-sj-raw-material.dto';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';
import { RawPaginationDto } from './dto/pagination.dto';
import { User } from '../user/entities/user.entity';
import { ConfigGroup } from 'src/database/entities/config-group.entity';

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 根据数据库实际数据提取的composition字段（不包含category、name、origin、inventory、remark等基础字段）
 */
export const FIXED_HEADERS = [
  'TFe', 'SiO2', 'CaO', 'MgO', 'Al2O3', 'P', 'S', 'TiO2', 'K2O', 'Na2O', 'Zn',
  'As', 'Pb', 'V2O5', 'H2O', '烧损', '价格',
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

const SORT_FIELD_MAP: Record<string, string> = {
  // 普通字段
  name: 'raw.name',
  category: 'raw.category',
  inventory: 'raw.inventory',
  created_at: 'raw.created_at',

  // JSON 字段（化学成分 / 主要参数）
  'composition.TFe': "JSON_EXTRACT(raw.composition, '$.TFe')",
  'composition.SiO2': "JSON_EXTRACT(raw.composition, '$.SiO2')",
  'composition.成本': "JSON_EXTRACT(raw.composition, '$.成本')",
};

@Injectable()
export class SjRawMaterialService {
  constructor(
    @InjectRepository(SjRawMaterial)
    private readonly rawRepo: Repository<SjRawMaterial>,

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

  /** ========================= 创建 ========================= */
  async create(dto: CreateSjRawMaterialDto, username: string) {
  const raw = this.rawRepo.create({
    ...dto,
      composition: this.normalizeComposition(dto.composition),
    inventory: dto.inventory ?? 0,
    modifier: username,
      remark: dto.remark ?? '',
  });
  return await this.rawRepo.save(raw);
}

  /** ========================= 更新 ========================= */
async update(id: number, dto: UpdateSjRawMaterialDto, username: string) {
  const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException('数据不存在');
  Object.assign(raw, dto, {
      composition: dto.composition ? this.normalizeComposition(dto.composition) : raw.composition,
    inventory: dto.inventory ?? raw.inventory,
    modifier: username,
      remark: dto.remark ?? raw.remark,
  });
  return await this.rawRepo.save(raw);
}

  /** 格式化原料数据（输出到前端） */
  private formatRaw(raw: SjRawMaterial) {
    const { id, category, name, origin, composition, remark, inventory } = raw;
  if (!composition) return { id, category, name, origin, remark, inventory };

    const normalized = this.normalizeComposition(composition);
    const { TFe = null, H2O = null, 烧损 = null, 价格 = null, ...otherComposition } = normalized;

  return {
    id,
    category,
    name,
    TFe,
    ...otherComposition,
    H2O,
    烧损,
    价格,
    inventory,
    origin,
    remark,
  };
}



  /**
   * 合并查询接口（返回分页 + 总数 + data）
   * 支持 name 模糊、type 前缀匹配（严格以 type 开头）
   */
  private readonly MODULE_NAME = '烧结配料计算';

async query(user: User, params: RawPaginationDto) {
  const { page = 1, pageSize = 10, name, type, sort, order } = params;

  const qb = this.rawRepo.createQueryBuilder('raw');

  // ================= 1️⃣ 名称模糊搜索 =================
  if (name) qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });

  // ================= 2️⃣ 分类筛选 =================
  if (type) qb.andWhere('raw.category LIKE :type', { type: `%${type}%` });

  // ================= 3️⃣ 排序 =================
  if (sort) {
    if (sort.startsWith('composition.')) {
      const key = sort.replace('composition.', '');
      qb.orderBy(
        `CAST(JSON_EXTRACT(raw.composition, '$."${key}"') AS DECIMAL)`,
        order === 'desc' ? 'DESC' : 'ASC'
      );
    } else if (SORT_FIELD_MAP[sort]) {
      qb.orderBy(SORT_FIELD_MAP[sort], order === 'desc' ? 'DESC' : 'ASC');
    } else {
      qb.orderBy('raw.id', 'ASC');
    }
  } else {
    qb.orderBy('raw.id', 'ASC');
  }

  // ⚠️ 不在 SQL 里分页
  const list = await qb.getMany();
  const total = list.length;

  // ================= 4️⃣ 获取已选原料 =================
  let selectedSet = new Set<number>();

  try {
    const configRepo = this.rawRepo.manager.getRepository(ConfigGroup);

    const config = await configRepo
      .createQueryBuilder('cg')
      .leftJoin('cg.user', 'user')
      .leftJoin('cg.module', 'module')
      .where('user.user_id = :userId', { userId: user.user_id })
      .andWhere('module.name = :moduleName', { moduleName: this.MODULE_NAME })
      .orderBy('cg.updated_at', 'DESC')
      .getOne();

    let configData: any = {};

    if (config?.config_data) {
      configData =
        typeof config.config_data === 'string'
          ? JSON.parse(config.config_data)
          : config.config_data;
    }

    const ingredientParams: number[] = configData.ingredientParams ?? [];

    if (ingredientParams.length) {
      selectedSet = new Set(ingredientParams.map((id) => Number(id)));
    }
  } catch (err) {
    console.warn('获取模块配置失败，不影响原料查询', err);
  }

  // ================= 5️⃣ 数据映射 =================
  const mapped = list.map((item) => ({
    ...item,
    composition: this.normalizeComposition(item.composition),
    selected: selectedSet.has(Number(item.id)),
  }));

  // ================= 6️⃣ selected 排前 =================
  mapped.sort((a, b) => {
    if (a.selected && !b.selected) return -1;
    if (!a.selected && b.selected) return 1;
    return 0;
  });

  // ================= 7️⃣ 内存分页 =================
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


  async findOne(id: number) {
    const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException(`原料ID ${id} 不存在`);
    return this.formatRaw(raw);
  }

  /**
   * 批量删除
   */
  async remove(ids: number[]) {
    if (!ids?.length) throw new Error('未提供要删除的ID');
    const raws = await this.rawRepo.findBy({ id: In(ids) });
    if (!raws.length) throw new NotFoundException(`原料ID ${ids.join(',')} 不存在`);
    return await this.rawRepo.remove(raws);
  }

  /**
   * 删除全部（并记录 modifier）
   */
  async removeAll(username: string) {
    const raws = await this.rawRepo.find();
    if (!raws.length) return { status: 'error', message: '原料库为空，无需删除' };
    // 更新 modifier 字段以记录操作者（不过这里使用 remove，因此只是先着色）
    raws.forEach(raw => (raw.modifier = username));
    await this.rawRepo.remove(raws);
    return { status: 'success', message: `成功删除 ${raws.length} 条原料数据` };
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
  const raws = await this.rawRepo.find();
  const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('烧结原料信息库');

    sheet.addRow(['分类编号', '原料', ...FIXED_HEADERS, '库存', '产地', '备注']);

  raws.forEach(raw => {
      const composition = this.normalizeComposition(raw.composition);
      sheet.addRow([
        raw.category ?? '',
        raw.name ?? '',
        ...FIXED_HEADERS.map(h => composition[h]),
        raw.inventory ?? 0,
        raw.origin ?? '',
        raw.remark ?? '',
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
      const allowedHeaders = ['分类编号', '原料', '库存', '产地', '备注', ...FIXED_HEADERS];
      if (!allowedHeaders.includes(val)) {
        throw new BadRequestException(`非法列名：${val}`);
      }
      headerMap[val] = col;
    });

    if (!headerMap['原料']) {
      throw new BadRequestException('缺少必要列：原料');
    }

    const result: SjRawMaterial[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = String(row.getCell(headerMap['原料'])?.value ?? '').trim();
      if (!name) return;

      const category = headerMap['分类编号'] ? String(row.getCell(headerMap['分类编号'])?.value ?? '').trim() : '';
      const origin = headerMap['产地'] ? String(row.getCell(headerMap['产地'])?.value ?? '').trim() : '其他粉矿';
      const inventory = headerMap['库存'] ? parseFloat(String(row.getCell(headerMap['库存'])?.value ?? 0)) || 0 : 0;
      const remark = headerMap['备注'] ? String(row.getCell(headerMap['备注'])?.value ?? '').trim() : '';

      const composition: Record<string, number> = {};

      FIXED_HEADERS.forEach(key => {
        const col = headerMap[key];
        const val = col ? parseFloat(String(row.getCell(col)?.value ?? '')) : 0;
        composition[key] = Number.isFinite(val) ? val : 0;
      });

      result.push(this.rawRepo.create({
        category,
        name,
        origin,
        composition,
        inventory,
        remark,
        modifier: username,
      }));
    });

    if (!result.length) {
      return { status: 'error', message: '没有有效数据可导入' };
    }

    await this.rawRepo.save(result);
    return { status: 'success', message: `成功导入 ${result.length} 条数据` };
  }

  /** ========================= 模板 ========================= */
  private readonly templateDir = process.env.TEMPLATE_PATH || './templates';
  private readonly templateFilename = 'sj-raw-material-template.xlsx';

  private async ensureTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.templateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('模板').addRow(['分类编号', '原料', ...FIXED_HEADERS, '库存', '产地', '备注']);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getTemplateFilePath(): Promise<string> {
    return this.ensureTemplateFileExists();
}

/** ========================= 批量修改模板 ========================= */
private async ensureBatchUpdateTemplateFileExists(): Promise<string> {
  await fs.promises.mkdir(this.templateDir, { recursive: true });
  const filePath = path.join(this.templateDir, 'sj-raw-material-batch-update-template.xlsx');
  if (fs.existsSync(filePath)) return filePath;

  const workbook = new ExcelJS.Workbook();
  // 批量修改支持按“物料名称”匹配；表头按前端示例保持一致
  workbook.addWorksheet('模板').addRow(['分类编号', '物料名称', ...FIXED_HEADERS, '库存', '产地', '备注']);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async getBatchUpdateTemplateFilePath(): Promise<string> {
  return this.ensureBatchUpdateTemplateFileExists();
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

/** ========================= 导入 Excel（批量修改） ========================= */
async importExcelBatchUpdate(file: Express.Multer.File, username: string) {
  try {
    if (!file?.buffer) return { status: 'error', message: '文件为空' };

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { status: 'error', message: 'Excel 中没有工作表' };

    const headerRow = sheet.getRow(1);
    const headerMap: Record<string, number> = {};
    const allowedHeaders = ['分类编号', '原料', '物料名称', '库存', '产地', '备注', ...FIXED_HEADERS];

    headerRow.eachCell((cell, col) => {
      const val = String(cell.value ?? '').trim();
      if (!val) return;
      if (allowedHeaders.includes(val)) headerMap[val] = col;
    });

    const materialCol = headerMap['原料'] ?? headerMap['物料名称'];
    if (!materialCol) return { status: 'error', message: '缺少必要列：原料/物料名称' };

    const rowPayloads: Array<{
      name: string;
      category?: string;
      origin?: string;
      remark?: string;
      inventory?: number;
      composition: Record<string, number>;
      cellErrors?: string[];
    }> = [];
    const names = new Set<string>();
    let collectedErrors: string[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;
      const name = this.cellToString(row.getCell(materialCol)?.value);
      if (!name) return;
      names.add(name);

      interface RowPayload {
        name: string;
        category?: string;
        origin?: string;
        remark?: string;
        inventory?: number;
        composition: Record<string, number>;
        cellErrors?: string[];
      }
      const payload: RowPayload = { name, composition: {} };
      if (headerMap['分类编号']) {
        const categoryText = this.cellToString(row.getCell(headerMap['分类编号']).value);
        if (categoryText) payload.category = categoryText;
      }
      if (headerMap['产地']) {
        const originText = this.cellToString(row.getCell(headerMap['产地']).value);
        if (originText) payload.origin = originText;
      }
      if (headerMap['备注']) {
        const remarkText = this.cellToString(row.getCell(headerMap['备注']).value);
        if (remarkText) payload.remark = remarkText;
      }
      let inventoryCellError = false;
      if (headerMap['库存']) {
        const inventoryText = this.cellToString(row.getCell(headerMap['库存']).value);
        const parsedInventory = this.parseNumericCellOrThrow(inventoryText, index, '库存');
        if (inventoryText && parsedInventory === undefined) {
          // 记录或处理“库存”单元格数据出错
          inventoryCellError = true;
        } else {
          payload.inventory = parsedInventory;
        }
      }

      let compositionErrorKeys: string[] = [];
      FIXED_HEADERS.forEach((key) => {
        const col = headerMap[key];
        if (!col) return;
        const text = this.cellToString(row.getCell(col).value);
        const value = this.parseNumericCellOrThrow(text, index, key);
        if (text && value === undefined) {
          // 记录化学成分出错的 key
          compositionErrorKeys.push(key);
        } else if (value !== undefined) {
          payload.composition[key] = value;
        }
      });

      // 合并错误提示，写入 payload，并收集到 collectedErrors 集中反馈
      if (inventoryCellError || compositionErrorKeys.length > 0) {
        if (!payload['cellErrors']) payload['cellErrors'] = [];
        if (inventoryCellError) {
          const msg = `第 ${index} 行“库存”格式有误`;
          payload['cellErrors'].push(msg);
          collectedErrors.push(msg);
        }
        if (compositionErrorKeys.length) {
          const msg = `第 ${index} 行成分字段 [${compositionErrorKeys.join(', ')}] 格式有误`;
          payload['cellErrors'].push(msg);
          collectedErrors.push(msg);
        }
      }
      rowPayloads.push(payload);
    });

    if (!rowPayloads.length) {
      return { status: 'error', message: '没有有效数据可导入（缺少物料名称）' };
    }

    if (collectedErrors.length) {
      // 有格式错误，返回错误信息但不中断服务
      return { status: 'error', message: `导入数据格式有误：\n${collectedErrors.join('\n')}` };
    }

    const existedRows = await this.rawRepo.find({ where: { name: In(Array.from(names)) } });
    const existedByName = new Map(existedRows.map((item) => [item.name, item]));
    const updates: SjRawMaterial[] = [];
    let skipped = 0;
    let skippedNoChange = 0;

    rowPayloads.forEach((row) => {
      const target = existedByName.get(row.name);
      if (!target) return void (skipped += 1);
      const hasAnyField =
        row.category !== undefined ||
        row.origin !== undefined ||
        row.remark !== undefined ||
        row.inventory !== undefined ||
        Object.keys(row.composition).length > 0;
      if (!hasAnyField) return void (skippedNoChange += 1);

      if (row.category !== undefined) target.category = row.category;
      if (row.origin !== undefined) target.origin = row.origin;
      if (row.remark !== undefined) target.remark = row.remark;
      if (row.inventory !== undefined) target.inventory = row.inventory;
      if (Object.keys(row.composition).length) {
        target.composition = this.normalizeComposition({ ...(target.composition ?? {}), ...row.composition });
      }
      target.modifier = username;
      updates.push(target);
    });

    if (!updates.length) {
      return { status: 'error', message: `未匹配到可更新数据，已跳过 ${skipped} 条未匹配物料、${skippedNoChange} 条无更新字段` };
    }
    await this.rawRepo.save(updates);
    return { status: 'success', message: `成功更新 ${updates.length} 条数据，跳过 ${skipped} 条未匹配物料、${skippedNoChange} 条无更新字段` };
  } catch (error) {
    // 捕获任何未处理的异常，防止服务器挂掉
    return { status: 'error', message: `导入失败: ${(error?.message || error || '未知错误')}` };
  }
}

private parseNumericCellOrThrow(rawText: string, rowIndex: number, header: string): number | undefined {
  if (!rawText) return undefined;
  const val = Number(rawText);
  if (!Number.isFinite(val)) {
    // 不抛出异常，改为返回 undefined，由调用者处理
    // 可以在调用处提供统一的用户提示，并说明未保存成功的原因
    return undefined;
  }
  return val;
}
}