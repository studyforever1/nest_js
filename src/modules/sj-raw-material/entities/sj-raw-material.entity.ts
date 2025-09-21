import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sj_raw_material')
export class SjRawMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '分类编号', nullable: true })
  category_code: string;

  @Column({ comment: '原料名称' })
  name: string;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'TFe 含量',
  })
  tfe: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'SiO2 含量',
  })
  sio2: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'CaO 含量',
  })
  cao: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'MgO 含量',
  })
  mgo: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Al2O3 含量',
  })
  al2o3: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'P 含量',
  })
  p: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'S 含量',
  })
  s: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'TiO2 含量',
  })
  tio2: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'K2O 含量',
  })
  k2o: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Na2O 含量',
  })
  na2o: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Zn 含量',
  })
  zn: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'As 含量',
  })
  as_: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Pb 含量',
  })
  pb: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'V2O5 含量',
  })
  v2o5: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'H2O 含量',
  })
  h2o: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    nullable: true,
    comment: '烧损',
  })
  loss: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '价格(元/吨)',
  })
  price: number;

  @Column({ comment: '产地', nullable: true })
  origin: string;

  @Column({ default: true, comment: '是否启用' })
  enabled: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
