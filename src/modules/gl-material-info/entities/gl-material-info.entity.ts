import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';


@Entity('gl_material_info')
export class GlMaterialInfo {
@PrimaryGeneratedColumn({ comment: '主键ID' })
id: number;


@Column({ comment: '原料名称' })
name: string;


@Column({ comment: '分类编号', nullable: true })
category: string;


@Column('json', { nullable: true, comment: '化学成分参数及其他指标，JSON格式' })
composition: Record<string, any>;


@Column({ type: 'float', default: 0, comment: '库存数量' })
inventory: number;


@Column({ comment: '产地', nullable: true })
origin: string;


@Column({ comment: '修改者', nullable: true })
modifier: string;


@Column({ default: true, comment: '是否启用' })
enabled: boolean;


@Column({ type: 'text', nullable: true, comment: '备注信息' })
remark: string;


@CreateDateColumn({ comment: '创建时间' })
created_at: Date;


@UpdateDateColumn({ comment: '更新时间' })
updated_at: Date;
}