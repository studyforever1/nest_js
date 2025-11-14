import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MineTypInd } from '../entities/mine-typ-ind.entity';

@Injectable()
export class MineTypIndService {
  constructor(
    @InjectRepository(MineTypInd)
    private readonly mineTypIndRepository: Repository<MineTypInd>,
  ) {}

  async findAll() {
    return await this.mineTypIndRepository.find();
  }

  async findOne(id: string) {
    return await this.mineTypIndRepository.findOne({ where: { id } });
  }

  async create(data: any) {
    const entity = this.mineTypIndRepository.create(data);
    return await this.mineTypIndRepository.save(entity);
  }

  async update(id: string, data: any) {
    await this.mineTypIndRepository.update(id, data);
    return await this.findOne(id);
  }

  async remove(id: string) {
    await this.mineTypIndRepository.delete(id);
  }
}
