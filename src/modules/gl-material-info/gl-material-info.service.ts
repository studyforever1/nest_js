import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { GlMaterialInfo } from './entities/gl-material-info.entity';
import { CreateGlMaterialInfoDto } from './dto/create-gl-material-info.dto';
import { UpdateGlMaterialInfoDto } from './dto/update-gl-material-info.dto';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';
import { User } from '../user/entities/user.entity';
import { ConfigGroup } from 'src/database/entities/config-group.entity';

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 */
export const FIXED_HEADERS = [
  'TFe','CaO','SiO2','MgO', 'Al2O3','S','P','TiO2','MnO', 'Cr', 'Pb', 'Zn', 'K2O','Na2O','Ni'
   , 'V2O5', 'H2O', '返焦率', '返矿价格', '干基价格'
];

/** 排序字段映射 */
const SORT_FIELD_MAP: Record<string, string> = {
  name: 'raw.name',
  category: 'raw.category',
  inventory: 'raw.inventory',
  created_at: 'raw.created_at',
  'composition.TFe': "JSON_EXTRACT(raw.composition, '$.TFe')",
  'composition.SiO2': "JSON_EXTRACT(raw.composition, '$.SiO2')",
  'composition.返矿价格': "JSON_EXTRACT(raw.composition, '$.返矿价格')",
  'composition.干基价格': "JSON_EXTRACT(raw.composition, '$.干基价格')",
};

@Injectable()
export class GlMaterialInfoService {
  private readonly SORT_FIELD_MAP = SORT_FIELD_MAP;

  constructor(
    @InjectRepository(GlMaterialInfo)
    private readonly rawRepo: Repository<GlMaterialInfo>,
  ) {}

  /** ========================= 核心：标准化 composition ========================= */
  private normalizeComposition(composition?: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    FIXED_HEADERS.forEach((key) => {
      result[key] = composition?.[key] ?? 0;
    });
    return result;
  }

  /** ========================= 创建 ========================= */
  async create(dto: CreateGlMaterialInfoDto, username: string) {
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
  async update(id: number, dto: UpdateGlMaterialInfoDto, username: string) {
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

  /** ========================= 格式化原料数据 ========================= */
  private formatRaw(raw: GlMaterialInfo) {
    const { id, category, name, origin, composition, remark, inventory, ...rest } = raw;
    return {
      id,
      category,
      name,
      origin,
      inventory,
      remark,
      composition: composition ? this.normalizeComposition(composition) : {},
      ...rest,
    };
  }
private readonly MODULE_NAME = '单独高炉配料计算';
  /** ========================= 分页查询 ========================= */
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

  // ⚠️ 不在 SQL 分页
  const records = await qb.getMany();
  const total = records.length;

  // ================= 4️⃣ 查询用户配置 =================
  let selectedSet = new Set<number>();

  try {
    const configRepo = this.rawRepo.manager.getRepository(ConfigGroup);

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

    let configData: any = {};

    if (config?.config_data) {
      configData =
        typeof config.config_data === 'string'
          ? JSON.parse(config.config_data)
          : config.config_data;
    }

    const ingredientParams: number[] = configData.ingredientParams ?? [];

    if (ingredientParams.length) {
      selectedSet = new Set(ingredientParams.map(id => Number(id)));
    }
  } catch (err) {
    console.warn('获取模块配置失败，不影响原料查询', err);
  }

  // ================= 5️⃣ 映射 =================
  const mapped = records.map(item => {
    const formatted = this.formatRaw(item);

    return {
      ...formatted,
      selected: selectedSet.has(Number(item.id)),
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

  /** ========================= 单条查询 ========================= */
  async findOne(id: number) {
    const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException(`原料ID ${id} 不存在`);
    return this.formatRaw(raw);
  }

  /** ========================= 批量删除 ========================= */
  async remove(ids: number[]) {
    if (!ids?.length) throw new Error('未提供要删除的ID');
    const raws = await this.rawRepo.findBy({ id: In(ids) });
    if (!raws.length) throw new NotFoundException(`原料ID ${ids.join(',')} 不存在`);
    return await this.rawRepo.remove(raws);
  }

  /** ========================= 删除全部 ========================= */
  async removeAll(username: string) {
    const raws = await this.rawRepo.find();
    if (!raws.length) return { status: 'error', message: '原料库为空，无需删除' };
    raws.forEach(raw => (raw.modifier = username));
    await this.rawRepo.remove(raws);
    return { status: 'success', message: `成功删除 ${raws.length} 条原料数据` };
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
    const raws = await this.rawRepo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('高炉原料信息库');

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
      if (!allowedHeaders.includes(val)) throw new BadRequestException(`非法列名：${val}`);
      headerMap[val] = col;
    });

    if (!headerMap['原料']) throw new BadRequestException('缺少必要列：原料');

    const result: GlMaterialInfo[] = [];
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

      result.push(this.rawRepo.create({ category, name, origin, composition, inventory, remark, modifier: username }));
    });

    if (!result.length) return { status: 'error', message: '没有有效数据可导入' };
    await this.rawRepo.save(result);
    return { status: 'success', message: `成功导入 ${result.length} 条数据` };
  }

  /** ========================= 模板 ========================= */
  private readonly templateDir = process.env.TEMPLATE_PATH || './templates';
  private readonly templateFilename = 'gl-material-info-template.xlsx';

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
}
