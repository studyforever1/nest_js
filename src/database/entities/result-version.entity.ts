import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from 'typeorm';
import { Result } from './result.entity';

@Entity()
export class ResultVersion {
  @PrimaryGeneratedColumn()
  version_id: number;

  @ManyToOne(() => Result, result => result.versions)
  result: Result;

  @Column('json')
  output_data: any;

  @CreateDateColumn()
  created_at: Date;
}
