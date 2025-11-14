import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sj_econ_info')
export class SjEconInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, comment: '原料名称' })
  name: string;

  @Column({ type: 'json', comment: '原料成分和价格信息，包含TFe、CaO、SiO2、MgO、Al2O3、S、P、TiO2、K2O、Na2O、Zn、Pb、As、V2O5、烧损、价格等' })
  composition: Record<string, any>;

  @Column({ length: 50, nullable: true, comment: '修改人' })
  modifier: string;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
