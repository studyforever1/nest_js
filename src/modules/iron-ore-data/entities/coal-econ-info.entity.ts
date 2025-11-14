import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('coal_econ_info')
export class CoalEconInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  supplierName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
