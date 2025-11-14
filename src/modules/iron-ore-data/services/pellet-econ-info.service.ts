import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PelletEconInfo } from '../entities/pellet-econ-info.entity';

@Injectable()
export class PelletEconInfoService {
  constructor(@InjectRepository(PelletEconInfo) private readonly repository: Repository<PelletEconInfo>) {}
  async findAll() { return await this.repository.find(); }
  async findOne(id: string) { return await this.repository.findOne({ where: { id } }); }
  async create(data: any) { const entity = this.repository.create(data); return await this.repository.save(entity); }
  async update(id: string, data: any) { await this.repository.update(id, data); return await this.findOne(id); }
  async remove(id: string) { await this.repository.delete(id); }
}
