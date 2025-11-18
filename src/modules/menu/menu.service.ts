import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm'; // ← 确保 In 已导入
import { Menu } from './entity/menu.entity';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private menuRepo: Repository<Menu>,
  ) {}

  async create(dto: CreateMenuDto) {
    const menu = this.menuRepo.create(dto);
    return this.menuRepo.save(menu);
  }

  async findAll(options: { page?: number; pageSize?: number; name?: string; tree?: '1' | '0' }) {
    const { page = 1, pageSize = 20, name, tree } = options;
    const qb = this.menuRepo.createQueryBuilder('menu').orderBy('menu.sort', 'ASC');

    if (name) {
      qb.where('menu.name LIKE :name', { name: `%${name}%` });
    }

    const list = await qb.getMany();

    if (tree === '1') {
      return this.buildTree(list, 0);
    }

    // 如果不是树结构，支持分页
    const start = (page - 1) * pageSize;
    return {
      total: list.length,
      data: list.slice(start, start + pageSize),
    };
  }

  private buildTree(list: Menu[], parentId: number) {
    return list
      .filter(item => item.parentId === parentId)
      .map(item => ({
        ...item,
        children: this.buildTree(list, item.id),
      }));
  }

  async findOne(id: number) {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException('菜单不存在');
    return menu;
  }

  async update(id: number, dto: UpdateMenuDto) {
    const menu = await this.findOne(id);
    Object.assign(menu, dto);
    return this.menuRepo.save(menu);
  }

  async remove(ids: number[]) {
    const menus = await this.menuRepo.findBy({ id: In(ids) });
    if (!menus.length) throw new NotFoundException('菜单不存在');
    return this.menuRepo.remove(menus);
  }
}
