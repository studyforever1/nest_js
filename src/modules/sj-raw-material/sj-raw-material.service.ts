import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SjRawMaterial } from './entities/sj-raw-material.entity';
import { CreateSjRawMaterialDto } from './dto/create-sj-raw-material.dto';
import { UpdateSjRawMaterialDto } from './dto/update-sj-raw-material.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class SjRawMaterialService {
  constructor(
    @InjectRepository(SjRawMaterial)
    private readonly rawRepo: Repository<SjRawMaterial>,
  ) {}

 async create(dto: CreateSjRawMaterialDto, username: string) {
  const raw = this.rawRepo.create({
    ...dto,
    modifier: username, // 自动填充
  });
  return await this.rawRepo.save(raw);
}

async update(id: number, dto: UpdateSjRawMaterialDto, username: string) {
  const raw = await this.findOne(id);
  Object.assign(raw, dto, { modifier: username }); // 更新时覆盖修改者
  return await this.rawRepo.save(raw);
}


  /** 查询所有原料 */
  async findAll() {
    return await this.rawRepo.find();
  }

  /** 查询单条原料 */
  async findOne(id: number) {
    const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException(`原料ID ${id} 不存在`);
    return raw;
  }

  /** 删除原料 */
  async remove(id: number) {
    const raw = await this.findOne(id);
    return await this.rawRepo.remove(raw);
  }

  /** ========== 导出 Excel ========== */
  async exportExcel(): Promise<Buffer> {
    const raws = await this.findAll();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('原料数据');

    // 先确定表头：固定字段 + 动态 JSON 成分字段
    const fixedHeaders = ['分类编号', '原料', '产地', '备注', '修改者'];
    const compositionKeys = new Set<string>();
    raws.forEach((raw) => {
      if (raw.composition) {
        Object.keys(raw.composition).forEach((k) => compositionKeys.add(k));
      }
    });
    const headers = [...fixedHeaders, ...Array.from(compositionKeys)];
    sheet.addRow(headers);

    // 填充数据
    raws.forEach((raw) => {
      const row: any[] = [
        raw.category,
        raw.name,
        raw.origin,
        raw.remark || '',
        raw.modifier || '',
      ];
      Array.from(compositionKeys).forEach((key) => {
        row.push(raw.composition?.[key] ?? null);
      });
      sheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
