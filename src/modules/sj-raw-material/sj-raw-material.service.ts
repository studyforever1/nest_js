import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { SjRawMaterial } from './entities/sj-raw-material.entity';
import { CreateSjRawMaterialDto } from './dto/create-sj-raw-material.dto';
import { UpdateSjRawMaterialDto } from './dto/update-sj-raw-material.dto';
import * as ExcelJS from 'exceljs';
import { Express } from 'express';

@Injectable()
export class SjRawMaterialService {
  constructor(
    @InjectRepository(SjRawMaterial)
    private readonly rawRepo: Repository<SjRawMaterial>,
  ) {}

  async create(dto: CreateSjRawMaterialDto, username: string) {
    const raw = this.rawRepo.create({
      ...dto,
      modifier: username,
    });
    return await this.rawRepo.save(raw);
  }

  async update(id: number, dto: UpdateSjRawMaterialDto, username: string) {
    const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException(`原料ID ${id} 不存在`);
    Object.assign(raw, dto, { modifier: username });
    return await this.rawRepo.save(raw);
  }

  /** 格式化原料数据（输出到前端） */
  private formatRaw(raw: SjRawMaterial) {
    const { id, category, name, origin, composition } = raw;
    if (!composition) return { id, category, name, origin };

    // 明确提取常用字段，剩余的放到 compositionFields
    const {
      TFe = null,
      H2O = null,
      烧损 = null,
      价格 = null,
      ...otherComposition
    } = composition as Record<string, any>;

    return {
      id,
      category,
      name,
      TFe,
      ...otherComposition,
      H2O,
      烧损,
      价格,
      origin,
    };
  }

  /**
   * 合并查询接口（返回分页 + 总数 + data）
   * 支持 name 模糊、type 前缀匹配（严格以 type 开头）
   */
  async query(options: {
    page?: number;
    pageSize?: number;
    name?: string;
    type?: string;
  }) {
    const { page = 1, pageSize = 10, name, type } = options;

    const qb = this.rawRepo.createQueryBuilder('raw').orderBy('raw.id', 'ASC');

    if (name) {
      qb.andWhere('raw.name LIKE :name', { name: `%${name}%` });
    }

    if (type) {
      // 以 type 为前缀（保持原有意图），防止误匹配更复杂字符串
      qb.andWhere('raw.category LIKE :cat', { cat: `${type}%` });
    }

    const [records, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();

    return {
      data: records.map(this.formatRaw),
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

  /**
   * 导出 Excel（智能列头：固定 + 动态成分）
   */
  async exportExcel(): Promise<Buffer> {
    const raws = await this.rawRepo.find();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('原料数据');

    const fixedHeaders = ['分类编号', '原料', 'TFe'];

    // 收集动态成分键（排除常用字段）
    const dynamicKeys = new Set<string>();
    raws.forEach(raw => {
      if (raw.composition) {
        Object.keys(raw.composition).forEach(key => {
          if (!['TFe', 'H2O', '烧损', '价格'].includes(key) && key.trim()) {
            dynamicKeys.add(key);
          }
        });
      }
    });

    const headers = [...fixedHeaders, ...Array.from(dynamicKeys).sort(), 'H2O', '烧损', '价格', '产地'];
    sheet.addRow(headers);

    raws.forEach(raw => {
      const row: any[] = [];
      row.push(raw.category ?? '');
      row.push(raw.name ?? '');
      row.push(raw.composition?.['TFe'] ?? null);

      Array.from(dynamicKeys).forEach(key => {
        row.push(raw.composition?.[key] ?? null);
      });

      row.push(raw.composition?.['H2O'] ?? null);
      row.push(raw.composition?.['烧损'] ?? null);
      row.push(raw.composition?.['价格'] ?? null);
      row.push(raw.origin ?? '');

      sheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * 导入 Excel（健壮解析、自动跳过空列、按行创建）
   * 返回导入结果（成功条数等）
   */
  async importExcel(file: Express.Multer.File, username: string) {
    try {
      if (!file?.buffer) return { status: 'error', message: '文件为空' };

      const workbook = new ExcelJS.Workbook();
      const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
      await workbook.xlsx.load(buffer as any);

      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('Excel 中没有工作表');

      // 读取表头（第一行）
      const headers: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
        const v = cell.value;
        const s = v === null || v === undefined ? '' : String(v).trim();
        headers.push(s);
      });

      // 关键列索引查找（返回的是 Excel 列号，从 1 开始）
      const getIndex = (name: string) => {
        const idx = headers.findIndex(h => h === name);
        return idx >= 0 ? idx + 1 : -1;
      };

      const categoryIndex = getIndex('分类编号');
      const nameIndex = getIndex('原料');
      const originIndex = getIndex('产地');
      const TFeIndex = getIndex('TFe');
      const H2OIndex = getIndex('H2O');
      const 烧损Index = getIndex('烧损');
      const 价格Index = getIndex('价格');

      // 动态字段：排除上面固定字段，且 header 非空
      const dynamicFieldIndices: { idx: number; key: string }[] = [];
      headers.forEach((h, i) => {
        const col = i + 1;
        if (
          col === categoryIndex ||
          col === nameIndex ||
          col === originIndex ||
          col === TFeIndex ||
          col === H2OIndex ||
          col === 烧损Index ||
          col === 价格Index
        ) {
          return;
        }
        if (h && h.trim()) {
          dynamicFieldIndices.push({ idx: col, key: h });
        }
      });

      const rawsToSave: SjRawMaterial[] = [];

      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // 跳过表头

        // 从行中读取基础字段
        const category = categoryIndex > 0 ? String(row.getCell(categoryIndex).value ?? '').trim() : '';
        const name = nameIndex > 0 ? String(row.getCell(nameIndex).value ?? '').trim() : '';
        const origin = originIndex > 0 ? String(row.getCell(originIndex).value ?? '').trim() : '其他粉矿';

        // 如果关键字段缺失（例如 name），则跳过该行
        if (!name) return;

        // 构建 composition（先插入动态字段，再覆盖固定字段）
        const composition: Record<string, any> = {};
        dynamicFieldIndices.forEach(({ idx, key }) => {
          const val = row.getCell(idx).value;
          const num = val === null || val === undefined || val === '' ? null : parseFloat(String(val).trim());
          if (num !== null && !Number.isNaN(num)) {
            composition[key] = num;
          } else {
            // 如果非数值，仍然写入原值（有些成分可能为字符串）
            if (val !== null && val !== undefined && String(val).trim() !== '') {
              composition[key] = String(val).trim();
            }
          }
        });

        // 固定字段：TFe/H2O/烧损/价格（优先覆盖）
        if (TFeIndex > 0) {
          const v = row.getCell(TFeIndex).value;
          composition['TFe'] = v === null || v === undefined || v === '' ? 0 : parseFloat(String(v)) || 0;
        } else {
          composition['TFe'] = composition['TFe'] ?? 0;
        }
        composition['H2O'] = H2OIndex > 0 ? parseFloat(String(row.getCell(H2OIndex).value ?? 0)) || 0 : composition['H2O'] ?? 0;
        composition['烧损'] = 烧损Index > 0 ? parseFloat(String(row.getCell(烧损Index).value ?? 0)) || 0 : composition['烧损'] ?? 0;
        composition['价格'] = 价格Index > 0 ? parseFloat(String(row.getCell(价格Index).value ?? 0)) || 0 : composition['价格'] ?? 0;

        const rawEntity = this.rawRepo.create({
          category,
          name,
          origin,
          composition,
          modifier: username,
        });
        rawsToSave.push(rawEntity);
      });

      if (rawsToSave.length === 0) return { status: 'error', message: '没有有效数据可导入' };

      await this.rawRepo.save(rawsToSave);
      return { status: 'success', message: `成功导入 ${rawsToSave.length} 条数据` };
    } catch (error) {
      console.error('importExcel error:', error);
      return { status: 'error', message: '导入失败，文件格式可能有误' };
    }
  }
}
