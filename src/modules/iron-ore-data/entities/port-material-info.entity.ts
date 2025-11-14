import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('port_material_info')
export class PortMaterialInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  materialName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
