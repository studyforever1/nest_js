import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import type { Express } from 'express';

import { CokeEconInfo } from './entities/coke-econ-info.entity';
import { CreateCokeEconInfoDto } from './dto/create-coke-econ-info.dto';
import { UpdateCokeEconInfoDto } from './dto/update-coke-econ-info.dto';

/**
 * ✅ 固定表头（唯一标准）
 * - 查询 / 导入 / 导出 / 前端展示 都以此为准
 * - 根据数据库实际数据提取的composition字段
 */
export const FIXED_HEADERS = [
  'C', 'S', 'M10', '内水', '水分', '灰分', 'M25/M40', '含粉率',
  '挥发份', '反应性CRI', '物料类别', '反应后强度CSR', '焦炭含税到厂价',
];

type FixedHeader = (typeof FIXED_HEADERS)[number];

/** 排序字段映射 */
const SORT_FIELD_MAP: Record<string, string> = {
  // 普通字段
  name: 'c.name',
  created_at: 'c.created_at',
  // JSON 字段
  'composition.焦炭含税到厂价': "JSON_EXTRACT(c.composition, '$.焦炭含税到厂价')",
};

@Injectable()
export class CokeEconInfoService {
  private readonly SORT_FIELD_MAP = SORT_FIELD_MAP;

  constructor(
    @InjectRepository(CokeEconInfo)
    private readonly repo: Repository<CokeEconInfo>,
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
  async create(dto: CreateCokeEconInfoDto, username: string) {
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
  async update(id: number, dto: UpdateCokeEconInfoDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('数据不存在');
    Object.assign(entity, dto, {
      composition: dto.composition ? this.normalizeComposition(dto.composition) : entity.composition,
      modifier: username,
    });
    return this.repo.save(entity);
  }

  /** ========================= 查询（核心修改点） ========================= */
  async query(options: { page: number; pageSize: number; name?: string; sort?: string; order?: 'asc' | 'desc' }) {
    const { page, pageSize, name, sort, order } = options;
    const qb = this.repo.createQueryBuilder('c');
    if (name) qb.andWhere('c.name LIKE :name', { name: `%${name}%` });
    
    // ⭐ 排序逻辑
    if (sort && this.SORT_FIELD_MAP[sort]) {
      qb.orderBy(
        this.SORT_FIELD_MAP[sort],
        order === 'desc' ? 'DESC' : 'ASC',
      );
    } else {
      qb.orderBy('c.id', 'ASC');
    }
    
    const [records, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();

    const mapped = records.map(item => ({
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
    if (!ids?.length) throw new Error('未提供删除 ID');

    const list = await this.repo.findBy({ id: In(ids) });
    if (!list.length) {
      throw new NotFoundException(`ID ${ids.join(',')} 不存在`);
    }
    return this.repo.remove(list);
  }

  async removeAll(username: string) {
    const list = await this.repo.find();
    if (!list.length) {
      return { status: 'error', message: '焦炭经济性库为空' };
    }

    list.forEach(i => (i.modifier = username));
    await this.repo.remove(list);

    return {
      status: 'success',
      message: `成功删除 ${list.length} 条记录`,
    };
  }

  /** ========================= 导出 Excel ========================= */
  async exportExcel(): Promise<Buffer> {
    const list = await this.repo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('焦炭信息库');

    sheet.addRow(['焦炭名称', ...FIXED_HEADERS]);

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
      if (!FIXED_HEADERS.includes(val as FixedHeader) && val !== '焦炭名称') {
        throw new BadRequestException(`非法列名：${val}`);
      }
      headerMap[val] = col;
    });

    if (!headerMap['焦炭名称']) {
      throw new BadRequestException('缺少必要列：焦炭名称');
    }

    const result: CokeEconInfo[] = [];

    sheet.eachRow({ includeEmpty: true }, (row, index) => {
      if (index === 1) return;

      const name = String(row.getCell(headerMap['焦炭名称'])?.value ?? '').trim();
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

  /** ========================= 模板 ========================= */
  private readonly templateDir = process.env.TEMPLATE_PATH || './templates';
  private readonly templateFilename = 'coke-econ-info-template.xlsx';

  private async ensureTemplateFileExists(): Promise<string> {
    await fs.promises.mkdir(this.templateDir, { recursive: true });
    const filePath = path.join(this.templateDir, this.templateFilename);
    if (fs.existsSync(filePath)) return filePath;

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('模板').addRow(['焦炭名称', ...FIXED_HEADERS]);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  async getTemplateFilePath(): Promise<string> {
    return this.ensureTemplateFileExists();
  }
}
