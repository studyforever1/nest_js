import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  async create(dto: CreateSjRawMaterialDto) {
    const raw = this.rawRepo.create(dto);
    return await this.rawRepo.save(raw);
  }

  async findAll() {
    return await this.rawRepo.find();
  }

  async findOne(id: number) {
    const raw = await this.rawRepo.findOne({ where: { id } });
    if (!raw) throw new NotFoundException(`原料ID ${id} 不存在`);
    return raw;
  }

  async update(id: number, dto: UpdateSjRawMaterialDto) {
    const raw = await this.findOne(id);
    Object.assign(raw, dto);
    return await this.rawRepo.save(raw);
  }

  async remove(id: number) {
    const raw = await this.findOne(id);
    return await this.rawRepo.remove(raw);
  }


  /** ========== 导出 Excel ========== */
  async exportExcel(): Promise<Buffer> {
    const raws = await this.findAll();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('原料数据');

    // 表头
    sheet.addRow([
      '分类编号',
      '原料',
      'TFe',
      'SiO2',
      'CaO',
      'MgO',
      'Al2O3',
      'P',
      'S',
      'TiO2',
      'K2O',
      'Na2O',
      'Zn',
      'As',
      'Pb',
      'V2O5',
      'H2O',
      '烧损',
      '价格',
      '产地',
    ]);

    // 数据
    raws.forEach((raw) => {
      sheet.addRow([
        raw.category_code,
        raw.name,
        raw.tfe,
        raw.sio2,
        raw.cao,
        raw.mgo,
        raw.al2o3,
        raw.p,
        raw.s,
        raw.tio2,
        raw.k2o,
        raw.na2o,
        raw.zn,
        raw.as_,
        raw.pb,
        raw.v2o5,
        raw.h2o,
        raw.loss,
        raw.price,
        raw.origin,
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
