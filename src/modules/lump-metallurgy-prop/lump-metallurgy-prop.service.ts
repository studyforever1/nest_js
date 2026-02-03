import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { Express } from 'express';

import { LumpMetallurgyProp } from './entities/lump-metallurgy-prop.entity';
import { CreateLumpMetallurgyPropDto } from './dto/create-lump-metallurgy-prop.dto';
import { UpdateLumpMetallurgyPropDto } from './dto/update-lump-metallurgy-prop.dto';

const SORT_FIELD_MAP: Record<string, string> = {
  name: 'l.name',
  created_at: 'l.created_at',
  'properties.TFe': "JSON_EXTRACT(l.properties, '$.TFe')",
};

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 注意：properties 中不包含"块矿名称"
 */
export const FIXED_HEADERS = [
  '块矿名称',
  'TFe', 'SiO2', 'Al2O3', 'P', 'S', 'MnO', 'H2O',
  '粉率', '车板价', '运费', '干粉价格',
  '厂内筛分搬到等费用', '干基不含税',
  'CaO', 'MgO', 'TiO2', 'Zn', 'K2O', 'Na2O',
  'Cr', 'Cu', 'As', '烧损', 'Ni',
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

@Injectable()
export class LumpMetallurgyPropService {
  constructor(
    @InjectRepository(LumpMetallurgyProp)
    private readonly repo: Repository<LumpMetallurgyProp>,
  ) {}

  /** =========================
   *  核心：规范化 properties（按 FIXED_HEADERS 顺序，排除"块矿名称"）
   * ========================= */
  private normalizeProperties(
    properties?: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    FIXED_HEADERS.forEach((key) => {
      if (key === '块矿名称') return; // 排除"块矿名称"
      result[key] = properties?.[key] ?? 0;
    });

    return result;
  }

  /** ========================= 创建 ========================= */
  async create(dto: CreateLumpMetallurgyPropDto, username: string) {
    const entity = this.repo.create({
      ...dto,
      properties: this.normalizeProperties(dto.properties),
      modifier: username,
      enabled: true,
    });
    return this.repo.save(entity);
  }

  /** ========================= 更新 ========================= */
  async update(id: number, dto: UpdateLumpMetallurgyPropDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`ID ${id} 不存在`);

    Object.assign(entity, {
      ...dto,
      properties: dto.properties ? this.normalizeProperties(dto.properties) : entity.properties,
      modifier: username,
    });

    return this.repo.save(entity);
  }

  /** ========================= 查询（核心修改点） ========================= */
  async query(options: { page: number; pageSize: number; name?: string; type?: string; sort?: string; order?: 'asc' | 'desc' }) {
    const { page = 1, pageSize = 10, name, type, sort, order } = options;
    const qb = this.repo.createQueryBuilder('l');

    if (name) {
      qb.andWhere('l.name LIKE :name', { name: `%${name}%` });
    }

    const sortField = sort && SORT_FIELD_MAP[sort]
      ? SORT_FIELD_MAP[sort]
      : 'l.id';

    qb.orderBy(sortField, order === 'desc' ? 'DESC' : 'ASC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [list, total] = await qb.getManyAndCount();

    /**
     * ✅ 规范化 properties，确保按 FIXED_HEADERS 顺序
     */
    const mapped = list.map(item => ({
      ...item,
      properties: this.normalizeProperties(item.properties),
    }));

    return { data: mapped, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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
    const sheet = workbook.addWorksheet('块矿冶金性能');

    // ✅ 按 FIXED_HEADERS 顺序导出
    sheet.addRow(FIXED_HEADERS);

    list.forEach(item => {
      const properties = this.normalizeProperties(item.properties);

      sheet.addRow([
        item.name,
        ...FIXED_HEADERS
          .filter(h => h !== '块矿名称')
          .map(h => properties[h]),
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

    // ✅ 严格校验表头：每个列名必须在 FIXED_HEADERS 中
    headerRow.eachCell((cell, col) => {
      const val = String(cell.value ?? '').trim();
      if (!val) return;
      if (!FIXED_HEADERS.includes(val as FixedHeader)) {
        throw new BadRequestException(`非法列名：${val}`);
      }
      headerMap[val] = col;
    });

    if (!headerMap['块矿名称']) {
      throw new BadRequestException('缺少必要列：块矿名称');
    }

    const result: LumpMetallurgyProp[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = String(row.getCell(headerMap['块矿名称'])?.value ?? '').trim();
      if (!name) return;

      const properties: Record<string, any> = {};

      // ✅ 遍历 FIXED_HEADERS，缺失列自动补0
      FIXED_HEADERS.forEach(key => {
        if (key === '块矿名称') return;
        const col = headerMap[key];
        const val = col ? parseFloat(String(row.getCell(col)?.value ?? '')) : 0;
        properties[key] = Number.isFinite(val) ? val : 0;
      });

      result.push(this.repo.create({
        name,
        properties: this.normalizeProperties(properties),
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

  /** ========================= 模板 ========================= */
  private readonly templateDir = process.env.TEMPLATE_PATH || './templates';
  private readonly templateFilename = 'lump-metallurgy-prop-template.xlsx';

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
}
