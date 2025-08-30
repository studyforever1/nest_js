import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { Task } from './task.entity';
import { ResultVersion } from './result-version.entity';


@Entity()
export class Result {
  @PrimaryGeneratedColumn()
  result_id: number;

  @ManyToOne(() => Task, task => task.results)
  task: Task;

  @Column('json', { nullable: true })
  output_data: any;

  @Column({ default: false })
  is_shared: boolean;

  @OneToMany(() => ResultVersion, version => version.result)
  versions: ResultVersion[];

  @CreateDateColumn()
  created_at: Date;
}
