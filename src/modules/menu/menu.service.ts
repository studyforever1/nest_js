import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Menu } from './entity/menu.entity';
import { User } from '../user/entities/user.entity';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private menuRepo: Repository<Menu>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(dto: CreateMenuDto) {
    const menu = this.menuRepo.create(dto);
    return this.menuRepo.save(menu);
  }

  /** 根据用户ID返回菜单树 */
  async getRoutes(userId: number) {
    const user = await this.userRepo.findOne({
      where: { user_id: userId },
      relations: ['roles', 'roles.menus'],
    });
    if (!user) throw new NotFoundException('用户不存在');

    let menus: Menu[];

    // 管理员返回所有菜单
    const isAdmin = user.roles.some(r => r.roleCode === 'admin');
    if (isAdmin) {
      menus = await this.menuRepo.find({
        where: { type: In([1, 2]) },
        order: { sort: 'ASC' },
      });
    } else {
      // 普通用户根据角色关联菜单
      const menuMap = new Map<number, Menu>();
      user.roles.forEach(role => {
        role.menus.forEach(menu => {
          if ([1, 2].includes(menu.type)) menuMap.set(menu.id, menu);
        });
      });
      menus = Array.from(menuMap.values());
    }

    const tree = this.buildTree(menus, 0);
    return tree.map(menu => this.formatRoute(menu));
  }

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

  private buildTree(list: Menu[], parentId: number) {
    return list
      .filter(item => Number(item.parentId) === Number(parentId))
      .map(item => ({
        ...item,
        children: this.buildTree(list, Number(item.id)),
      }));
  }

  async findAll(options: { page?: number; pageSize?: number; name?: string; tree?: any }) {
    const { page = 1, pageSize = 20, name, tree } = options;
    const qb = this.menuRepo.createQueryBuilder('menu').orderBy('menu.sort', 'ASC');

    if (name) qb.where('menu.name LIKE :name', { name: `%${name}%` });

    const list = await qb.getMany();

    const isTree = ['1', 1, true, 'true', 'yes', 'on'].includes(tree);
    if (isTree) return this.buildTree(list, 0);

    const start = (page - 1) * pageSize;
    return { total: list.length, data: list.slice(start, start + pageSize) };
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
