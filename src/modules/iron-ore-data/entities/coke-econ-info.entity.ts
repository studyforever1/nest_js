import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('coke_econ_info')
export class CokeEconInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  supplierName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
