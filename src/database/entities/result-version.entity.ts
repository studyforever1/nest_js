import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class ResultVersion {
  @PrimaryGeneratedColumn()
  version_id: number;

  @Column('json')
  output_data: any;

  @CreateDateColumn()
  created_at: Date;
}
