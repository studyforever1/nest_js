// common/database/entities/parameter-history.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { ConfigGroup } from './config-group.entity';
import { User } from '../../modules/user/entities/user.entity';

@Entity('parameter_history')
export class ParameterHistory {
  @PrimaryGeneratedColumn()
  history_id: number;

  @ManyToOne(() => ConfigGroup, (group) => group.history)
  group: ConfigGroup;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'json', comment: '旧参数快照' })
  old_config_data: any;

  @Column({ type: 'json', comment: '修改差异' })
  diff_data: any;

  @CreateDateColumn()
  modified_at: Date;
}
