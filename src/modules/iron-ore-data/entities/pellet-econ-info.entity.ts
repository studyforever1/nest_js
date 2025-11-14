import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pellet_econ_info')
export class PelletEconInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  supplierName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
