import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { GlFuelInfo } from './entities/gl-fuel-info.entity';
import { CreateGlFuelInfoDto } from './dto/create-gl-fuel-info.dto';
import { UpdateGlFuelInfoDto } from './dto/update-gl-fuel-info.dto';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';
import { ConfigGroup } from 'src/database/entities/config-group.entity';
import { User } from '../user/entities/user.entity';

export const FIXED_HEADERS = [
  'TFe','CaO','SiO2','MgO', 'Al2O3','S','P','TiO2','MnO', 'Cr', 'Pb', 'Zn', 'K2O','Na2O','Ni'
   , 'V2O5', 'H2O', '返焦率', '返焦价格', '干基价格'
];

const SORT_FIELD_MAP: Record<string, string> = {
  name: 'raw.name',
  category: 'raw.category',
  inventory: 'raw.inventory',
  created_at: 'raw.created_at',
  'composition.TFe': "JSON_EXTRACT(raw.composition, '$.TFe')",
  'composition.SiO2': "JSON_EXTRACT(raw.composition, '$.SiO2')",
  'composition.返焦价格': "JSON_EXTRACT(raw.composition, '$.返焦价格')",
  'composition.干基价格': "JSON_EXTRACT(raw.composition, '$.干基价格')",
};

@Injectable()
export class GlFuelInfoService {
  private readonly SORT_FIELD_MAP = SORT_FIELD_MAP;

  constructor(
    @InjectRepository(GlFuelInfo)
    private readonly rawRepo: Repository<GlFuelInfo>,
  ) {}

  private normalizeComposition(composition?: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    FIXED_HEADERS.forEach(key => {
      result[key] = composition?.[key] ?? 0;
    });
    return result;
  }

  private formatRaw(raw: GlFuelInfo) {
    const { id, category, name, composition, remark, inventory, ...rest } = raw;
    return {
      id,
      category,
      name,
      inventory,
      remark,
      composition: composition ? this.normalizeComposition(composition) : {},
      ...rest,
    };
  }

  async create(dto: CreateGlFuelInfoDto, username: string) {
    const raw = this.rawRepo.create({
      ...dto,
      composition: this.normalizeComposition(dto.composition),
      inventory: dto.inventory ?? 0,
      modifier: username,
      remark: dto.remark ?? '',
    });
    return this.rawRepo.save(raw);
  }

  async update(id: number, dto: UpdateGlFuelInfoDto, username: string) {
    const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException('数据不存在');
    Object.assign(raw, dto, {
      composition: dto.composition ? this.normalizeComposition(dto.composition) : raw.composition,
      inventory: dto.inventory ?? raw.inventory,
      modifier: username,
      remark: dto.remark ?? raw.remark,
    });
    return this.rawRepo.save(raw);
  }
private readonly MODULE_NAME = '单独高炉配料计算';
async query(
  user: User,
  options: {
    page?: number;
    pageSize?: number;
    name?: string;
    type?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  },
) {
  const { page = 1, pageSize = 10, name, type, sort, order } = options;

  const qb = this.rawRepo.createQueryBuilder('raw');

  // ================= 1️⃣ 名称模糊 =================
  if (name) {
    qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });
  }

  // ================= 2️⃣ 分类筛选 =================
  if (type) {
    qb.andWhere('raw.category LIKE :type', { type: `%${type}%` });
  }

  // ================= 3️⃣ 排序 =================
  if (sort) {
    if (sort.startsWith('composition.')) {
      const key = sort.replace('composition.', '');

      qb.orderBy(
        `CAST(JSON_EXTRACT(raw.composition, '$."${key}"') AS DECIMAL)`,
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else if (this.SORT_FIELD_MAP[sort]) {
      qb.orderBy(
        this.SORT_FIELD_MAP[sort],
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else {
      qb.orderBy('raw.id', 'ASC');
    }
  } else {
    qb.orderBy('raw.id', 'ASC');
  }

  // ❗不在 SQL 里分页
  const records = await qb.getMany();
  const total = records.length;

  // ================= 4️⃣ 获取已选 fuelParams =================
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

    const fuelParams: number[] = configData.fuelParams ?? [];

    if (fuelParams.length) {
      selectedSet = new Set(fuelParams.map(id => Number(id)));
    }
  } catch (err) {
    console.warn('获取模块配置失败，不影响燃料查询', err);
  }

  // ================= 5️⃣ 映射 =================
  const mapped = records.map(r => {
    const formatted = this.formatRaw(r);

    return {
      ...formatted,
      selected: selectedSet.has(Number(r.id)),
    };
  });

  // ================= 6️⃣ 已选排前 =================
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

  async remove(ids: number[]) {
    if (!ids?.length) throw new Error('未提供要删除的ID');
    const raws = await this.rawRepo.findBy({ id: In(ids) });
    if (!raws.length) throw new NotFoundException(`原料ID ${ids.join(',')} 不存在`);
    return this.rawRepo.remove(raws);
  }

  async removeAll(username: string) {
    const raws = await this.rawRepo.find();
    if (!raws.length) return { status: 'error', message: '原料库为空，无需删除' };
    raws.forEach(r => r.modifier = username);
    await this.rawRepo.remove(raws);
    return { status: 'success', message: `成功删除 ${raws.length} 条原料数据` };
  }

  async exportExcel(): Promise<Buffer> {
    const raws = await this.rawRepo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('高炉燃料信息库');
    sheet.addRow(['分类编号', '原料', ...FIXED_HEADERS, '库存', '备注']);

    raws.forEach(r => {
      const comp = this.normalizeComposition(r.composition);
      sheet.addRow([
        r.category ?? '',
        r.name ?? '',
        ...FIXED_HEADERS.map(h => comp[h]),
        r.inventory ?? 0,
        r.remark ?? '',
      ]);
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

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
      const allowedHeaders = ['分类编号','原料','库存','备注',...FIXED_HEADERS];
      if (!allowedHeaders.includes(val)) throw new BadRequestException(`非法列名：${val}`);
      headerMap[val] = col;
    });
    if (!headerMap['原料']) throw new BadRequestException('缺少必要列：原料');

    const result: GlFuelInfo[] = [];
    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;
      const name = String(row.getCell(headerMap['原料'])?.value ?? '').trim();
      if (!name) return;
      const category = headerMap['分类编号'] ? String(row.getCell(headerMap['分类编号'])?.value ?? '').trim() : '';
      const inventory = headerMap['库存'] ? parseFloat(String(row.getCell(headerMap['库存'])?.value ?? 0)) || 0 : 0;
      const remark = headerMap['备注'] ? String(row.getCell(headerMap['备注'])?.value ?? '').trim() : '';

      const composition: Record<string, number> = {};
      FIXED_HEADERS.forEach(h => {
        const col = headerMap[h];
        const val = col ? parseFloat(String(row.getCell(col)?.value ?? '')) : 0;
        composition[h] = Number.isFinite(val) ? val : 0;
      });

      result.push(this.rawRepo.create({ category, name, inventory, remark, composition, modifier: username }));
    });

    if (!result.length) return { status: 'error', message: '没有有效数据可导入' };
    await this.rawRepo.save(result);
    return { status: 'success', message: `成功导入 ${result.length} 条数据` };
  }

  private readonly templateDir = process.env.TEMPLATE_PATH || './templates';
  private readonly templateFilename = 'gl-fuel-info-template.xlsx';

  private async ensureTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.templateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('模板').addRow(['分类编号','原料', ...FIXED_HEADERS,'库存','备注']);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getTemplateFilePath(): Promise<string> {
    return this.ensureTemplateFileExists();
  }


   /** ========================= 导入 Excel（批量修改） ========================= */
   async importExcelBatchUpdate(file: Express.Multer.File, username: string) {
    if (!file?.buffer) throw new BadRequestException('文件为空');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel 中没有工作表');

    const headerRow = sheet.getRow(1);
    const headerMap: Record<string, number> = {};
    const allowedHeaders = ['分类编号', '原料', '物料名称', '库存', '备注', ...FIXED_HEADERS];

    headerRow.eachCell((cell, col) => {
      const val = String(cell.value ?? '').trim();
      if (!val) return;
      if (allowedHeaders.includes(val)) headerMap[val] = col;
    });

    const materialCol = headerMap['原料'] ?? headerMap['物料名称'];
    if (!materialCol) throw new BadRequestException('缺少必要列：原料/物料名称');

    const rowPayloads: Array<{
      name: string;
      category?: string;
      remark?: string;
      inventory?: number;
      composition: Record<string, number>;
    }> = [];
    const names = new Set<string>();

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;
      const name = this.cellToString(row.getCell(materialCol)?.value);
      if (!name) return;
      names.add(name);

      const payload: {
        name: string;
        category?: string;
        remark?: string;
        inventory?: number;
        composition: Record<string, number>;
      } = { name, composition: {} };

      if (headerMap['分类编号']) {
        const categoryText = this.cellToString(row.getCell(headerMap['分类编号']).value);
        const categoryNum = this.parseNumericCellOrThrow(categoryText, index, '分类编号');
        if (categoryNum !== undefined) payload.category = String(categoryNum);
      }
      if (headerMap['备注']) {
        const remarkText = this.cellToString(row.getCell(headerMap['备注']).value);
        if (remarkText) payload.remark = remarkText;
      }
      if (headerMap['库存']) {
        const inventoryText = this.cellToString(row.getCell(headerMap['库存']).value);
        payload.inventory = this.parseNumericCellOrThrow(inventoryText, index, '库存');
      }
      FIXED_HEADERS.forEach((key) => {
        const col = headerMap[key];
        if (!col) return;
        const text = this.cellToString(row.getCell(col).value);
        const value = this.parseNumericCellOrThrow(text, index, key);
        if (value !== undefined) payload.composition[key] = value;
      });
      rowPayloads.push(payload);
    });

    if (!rowPayloads.length) return { status: 'error', message: '没有有效数据可导入（缺少物料名称）' };

    const existedRows = await this.rawRepo.find({ where: { name: In(Array.from(names)) } });
    const existedByName = new Map(existedRows.map((item) => [item.name, item]));
    const updates: GlFuelInfo[] = [];
    let skipped = 0;
    let skippedNoChange = 0;

    rowPayloads.forEach((row) => {
      const target = existedByName.get(row.name);
      if (!target) return void (skipped += 1);
      const hasAnyField =
        row.category !== undefined ||
        row.remark !== undefined ||
        row.inventory !== undefined ||
        Object.keys(row.composition).length > 0;
      if (!hasAnyField) return void (skippedNoChange += 1);

      if (row.category !== undefined) target.category = row.category;
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
  }


    /** ========================= 批量修改模板 ========================= */
    private async ensureBatchUpdateTemplateFileExists(): Promise<string> {
      await fs.promises.mkdir(this.templateDir, { recursive: true });
      const filePath = path.join(this.templateDir, 'gl-fuel-info-batch-update-template.xlsx');
      if (fs.existsSync(filePath)) return filePath;
  
      const workbook = new ExcelJS.Workbook();
      // 燃料库没有“产地”字段，批量修改模板按现有导入/导出字段保持一致
      workbook.addWorksheet('模板').addRow(['分类编号', '物料名称', ...FIXED_HEADERS, '库存', '备注']);
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

    private parseNumericCellOrThrow(rawText: string, rowIndex: number, header: string): number | undefined {
      if (!rawText) return undefined;
      const val = Number(rawText);
      if (!Number.isFinite(val)) {
        return undefined;
      }
      return val;
    }
}
