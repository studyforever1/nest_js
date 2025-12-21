import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Express } from 'express';

import { LumpMetallurgyProp } from './entities/lump-metallurgy-prop.entity';
import { CreateLumpMetallurgyPropDto } from './dto/create-lump-metallurgy-prop.dto';
import { UpdateLumpMetallurgyPropDto } from './dto/update-lump-metallurgy-prop.dto';

function getCellText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((i: any) => i.text).join('');
    if ('result' in v) return String(v.result ?? '');
  }
  return String(v);
}

function getCellValue(v: any) {
  if (v == null) return null;
  if (typeof v === 'object' && 'result' in v) return v.result;
  return v;
}

function normalizeHeader(v: any): string {
  return getCellText(v).replace(/\u00A0/g, '').replace(/\s+/g, '').trim();
}

@Injectable()
export class LumpMetallurgyPropService {
  constructor(
    @InjectRepository(LumpMetallurgyProp)
    private readonly repo: Repository<LumpMetallurgyProp>,
  ) {}

  async create(dto: CreateLumpMetallurgyPropDto, username: string) {
    return this.repo.save(
      this.repo.create({
        ...dto,
        properties: dto.properties ?? {},
        modifier: username,
        enabled: true,
      }),
    );
  }

  async update(id: number, dto: UpdateLumpMetallurgyPropDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`ID ${id} 不存在`);

    Object.assign(entity, dto, {
      properties: dto.properties ?? entity.properties,
      modifier: username,
    });

    return this.repo.save(entity);
  }

  async query(options: { page: number; pageSize: number; name?: string }) {
    const { page, pageSize, name } = options;
    const qb = this.repo.createQueryBuilder('l').orderBy('l.id', 'ASC');
    if (name) qb.andWhere('l.name LIKE :name', { name: `%${name}%` });

    const [data, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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

  /** Excel 导出 */
  async exportExcel(): Promise<Buffer> {
    const list = await this.repo.find();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('块矿冶金性能');

    const keys = new Set<string>();
    list.forEach(i => Object.keys(i.properties ?? {}).forEach(k => k && keys.add(k)));

    ws.addRow(['块矿名称', ...Array.from(keys)]);
    list.forEach(i => ws.addRow([i.name, ...Array.from(keys).map(k => i.properties?.[k] ?? null)]));

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /** Excel 导入 */
  async importExcel(file: Express.Multer.File, username: string) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);
    const ws = wb.worksheets[0];

    const headers: string[] = [];
    ws.getRow(1).eachCell(c => headers.push(normalizeHeader(c.value)));

    const nameIndex = headers.indexOf('块矿名称') + 1;
    if (!nameIndex) return { message: '缺少【块矿名称】列' };

    const dynamicCols = headers.map((h, i) => ({ key: h, idx: i + 1 })).filter(c => c.idx !== nameIndex && c.key);
    const toSave: LumpMetallurgyProp[] = [];

    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const name = normalizeHeader(row.getCell(nameIndex).value);
      if (!name) return;

      const properties: Record<string, any> = {};
      dynamicCols.forEach(c => { properties[c.key] = getCellValue(row.getCell(c.idx).value); });

      toSave.push(this.repo.create({ name, properties, modifier: username, enabled: true }));
    });

    await this.repo.save(toSave);
    return { message: `成功导入 ${toSave.length} 条` };
  }
}
