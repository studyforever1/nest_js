import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Express } from 'express';

import { LumpEconInfo } from './entities/lump-econ-info.entity';
import { CreateLumpEconInfoDto } from './dto/create-lump-econ-info.dto';
import { UpdateLumpEconInfoDto } from './dto/update-lump-econ-info.dto';

@Injectable()
export class LumpEconInfoService {
  constructor(
    @InjectRepository(LumpEconInfo)
    private readonly repo: Repository<LumpEconInfo>,
  ) {}

  /** 新增 */
  async create(dto: CreateLumpEconInfoDto, username: string) {
    const entity = this.repo.create({
      ...dto,
      composition: dto.composition ?? {},
      modifier: username,
      enabled: true,
    });
    return this.repo.save(entity);
  }

  /** 更新 */
  async update(id: number, dto: UpdateLumpEconInfoDto, username: string) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`ID ${id} 不存在`);

    Object.assign(entity, dto, {
      composition: dto.composition ?? entity.composition,
      modifier: username,
    });

    return this.repo.save(entity);
  }

  /** 查询（分页 + 名称模糊） */
  async query(options: { page: number; pageSize: number; name?: string }) {
    const { page, pageSize, name } = options;

    const qb = this.repo
      .createQueryBuilder('l')
      .orderBy('l.id', 'ASC');

    if (name) {
      qb.andWhere('l.name LIKE :name', { name: `%${name}%` });
    }

    const [records, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** 批量删除 */
  async remove(ids: number[]) {
    if (!ids?.length) throw new Error('未提供删除 ID');

    const list = await this.repo.findBy({ id: In(ids) });
    if (!list.length) {
      throw new NotFoundException(`ID ${ids.join(',')} 不存在`);
    }
    return this.repo.remove(list);
  }

  /** 清空 */
  async removeAll(username: string) {
    const list = await this.repo.find();
    if (!list.length) {
      return { status: 'error', message: '块矿经济性库为空' };
    }

    list.forEach(i => (i.modifier = username));
    await this.repo.remove(list);

    return {
      status: 'success',
      message: `成功删除 ${list.length} 条记录`,
    };
  }

  /** Excel 导出（动态 composition） */
  async exportExcel(): Promise<Buffer> {
    const list = await this.repo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('块矿经济性');

    /** 动态字段（排除“物料类别”） */
    const dynamicKeys = new Set<string>();
    list.forEach(i => {
      Object.keys(i.composition ?? {}).forEach(k => {
        if (k && k !== '港口') {
          dynamicKeys.add(k);
        }
      });
    });

    /** 表头 */
    const headers = ['块矿名称', '港口', ...Array.from(dynamicKeys)];
    sheet.addRow(headers);

    /** 数据 */
    list.forEach(i => {
      sheet.addRow([
        i.name,
        i.composition?.['港口'] ?? null,
        ...Array.from(dynamicKeys).map(k => i.composition?.[k] ?? null),
      ]);
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Excel 导入 */
  async importExcel(file: Express.Multer.File, username: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    const sheet = workbook.worksheets[0];

    const headers: string[] = [];
    sheet.getRow(1).eachCell(cell =>
      headers.push(String(cell.value ?? '').trim()),
    );

    const nameIndex = headers.indexOf('块矿名称') + 1;
    if (!nameIndex) {
      return { status: 'error', message: '缺少【块矿名称】列' };
    }

    const dynamicCols = headers
      .map((h, i) => ({ key: h, idx: i + 1 }))
      .filter(c => c.idx !== nameIndex && c.key);

    const toSave: LumpEconInfo[] = [];

    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;

      const name = String(row.getCell(nameIndex).value ?? '').trim();
      if (!name) return;

      const composition: Record<string, any> = {};
      dynamicCols.forEach(c => {
        composition[c.key] = row.getCell(c.idx).value;
      });

      toSave.push(
        this.repo.create({
          name,
          composition,
          modifier: username,
          enabled: true,
        }),
      );
    });

    await this.repo.save(toSave);
    return { status: 'success', message: `成功导入 ${toSave.length} 条` };
  }
}
