import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SjEconInfo } from './entities/sj-econ-info.entity';
import { CreateSjEconInfoDto } from './dto/create-sj-econ-info.dto';
import { UpdateSjEconInfoDto } from './dto/update-sj-econ-info.dto';
import * as ExcelJS from 'exceljs';
import { Express } from 'express';

@Injectable()
export class SjEconInfoService {
  constructor(
    @InjectRepository(SjEconInfo)
    private readonly econRepo: Repository<SjEconInfo>,
  ) {}

  /** 新增 */
  async create(dto: CreateSjEconInfoDto, username: string) {
    const econ = this.econRepo.create({
      ...dto,
      composition: dto.composition ?? {},
      modifier: username,
      enabled: true,
    });
    return this.econRepo.save(econ);
  }

  /** 更新 */
  async update(id: number, dto: UpdateSjEconInfoDto, username: string) {
    const econ = await this.econRepo.findOne({ where: { id } });
    if (!econ) throw new NotFoundException(`经济指标 ID ${id} 不存在`);

    Object.assign(econ, dto, {
      composition: dto.composition ?? econ.composition,
      modifier: username,
    });

    return this.econRepo.save(econ);
  }

  /** 查询（分页 + 名称模糊） */
  async query(options: {
    page: number;
    pageSize: number;
    name?: string;
  }) {
    const { page, pageSize, name } = options;

    const qb = this.econRepo
      .createQueryBuilder('e')
      .orderBy('e.id', 'ASC');

    if (name) {
      qb.andWhere('e.name LIKE :name', { name: `%${name}%` });
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
    if (!ids?.length) throw new Error('未提供要删除的 ID');

    const list = await this.econRepo.findBy({ id: In(ids) });
    if (!list.length) {
      throw new NotFoundException(`ID ${ids.join(',')} 不存在`);
    }

    return this.econRepo.remove(list);
  }

  /** 删除全部 */
  async removeAll(username: string) {
    const list = await this.econRepo.find();
    if (!list.length) {
      return { status: 'error', message: '经济指标库为空' };
    }

    list.forEach(i => (i.modifier = username));
    await this.econRepo.remove(list);

    return {
      status: 'success',
      message: `成功删除 ${list.length} 条经济指标`,
    };
  }

  /** 导出 Excel（动态 composition 列，不包含是否启用） */
async exportExcel(): Promise<Buffer> {
  const list = await this.econRepo.find();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('经济指标');

  // 收集动态字段
  const dynamicKeys = new Set<string>();
  list.forEach(i => {
    if (i.composition) {
      Object.keys(i.composition).forEach(k => {
        if (k && k.trim()) dynamicKeys.add(k);
      });
    }
  });

  // 表头（不再包含“是否启用”）
  const headers = ['名称', ...Array.from(dynamicKeys)];
  sheet.addRow(headers);

  // 数据行
  list.forEach(i => {
    const row = [
      i.name,
      ...Array.from(dynamicKeys).map(k => i.composition?.[k] ?? null),
    ];
    sheet.addRow(row);
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}


  /** 导入 Excel */
  async importExcel(file: Express.Multer.File, username: string) {
    if (!file?.buffer) {
      return { status: 'error', message: '文件为空' };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return { status: 'error', message: 'Excel 中没有工作表' };
    }

    // 读取表头
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, cell => {
      headers.push(String(cell.value ?? '').trim());
    });

    const nameIndex = headers.indexOf('名称') + 1;
    if (nameIndex <= 0) {
      return { status: 'error', message: '缺少【名称】列' };
    }

    const dynamicCols = headers
      .map((h, i) => ({ key: h, idx: i + 1 }))
      .filter(c => c.idx !== nameIndex && c.key);

    const toSave: SjEconInfo[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const name = String(row.getCell(nameIndex).value ?? '').trim();
      if (!name) return;

      const composition: Record<string, any> = {};
      dynamicCols.forEach(c => {
        composition[c.key] = row.getCell(c.idx).value;
      });

      toSave.push(
        this.econRepo.create({
          name,
          composition,
          modifier: username,
          enabled: true,
        }),
      );
    });

    if (!toSave.length) {
      return { status: 'error', message: '没有可导入的数据' };
    }

    await this.econRepo.save(toSave);

    return {
      status: 'success',
      message: `成功导入 ${toSave.length} 条经济指标`,
    };
  }
}
