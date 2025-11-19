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
/** 返回前端路由结构 */
async getRoutes() {
  // 只返回：目录(type=2) + 菜单(type=1)
  const menus = await this.menuRepo.find({
    where: { type: In([1, 2]) },
    order: { sort: 'ASC' },
  });

  const tree = this.buildTree(menus, 0);
  return tree.map(menu => this.formatRoute(menu));

}

  /** 格式化为前端路由格式 */
  private formatRoute(menu: Menu) {
  return {
    path: menu.routePath?.startsWith('/') ? menu.routePath : `/${menu.routePath}`,
    component: menu.component || 'Layout',
    redirect: menu.redirect || undefined,
    name: menu.routeName || menu.routePath || '/',
    meta: {
      title: menu.name,
      icon: menu.icon || '',
      hidden: menu.visible === 0,
      keepAlive: true,
      alwaysShow: false,
      params: null,
    },
    children: (menu.children ?? []).map(c => this.formatRoute(c)),
  };
}


  async findAll(options: { page?: number; pageSize?: number; name?: string; tree?: any }) {
  const { page = 1, pageSize = 20, name, tree } = options;

  const qb = this.menuRepo
    .createQueryBuilder('menu')
    .orderBy('menu.sort', 'ASC');

  if (name) {
    qb.where('menu.name LIKE :name', { name: `%${name}%` });
  }

  const list = await qb.getMany();

  // --- 修复前端 tree=1 / tree=true / tree=yes 均返回树结构 ---
  const isTree = ['1', 1, true, 'true', 'yes', 'on'].includes(tree);

  if (isTree) {
    return this.buildTree(list, 0);
  }

  //分页返回
  const start = (page - 1) * pageSize;
  return {
    total: list.length,
    data: list.slice(start, start + pageSize),
  };
}


  private buildTree(list: Menu[], parentId: number) {
  return list
    .filter(item => Number(item.parentId) === Number(parentId))
    .map(item => ({
      ...item,
      children: this.buildTree(list, Number(item.id)),
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
