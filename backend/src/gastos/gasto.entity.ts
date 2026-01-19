import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { Caja } from '../caja/caja.entity';

@Entity('gastos')
export class Gasto {
  @PrimaryGeneratedColumn({ name: 'id_gasto' })
  id_gasto: number;

  
  @ManyToOne(() => Usuario, (u) => u.gastos, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @RelationId((g: Gasto) => g.usuario)
  readonly id_usuario: number;

 
  @ManyToOne(() => Caja, (c) => c.gastos, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_caja' })
  caja?: Caja | null;

  @RelationId((g: Gasto) => g.caja)
  readonly id_caja?: number | null;

  // ====== Datos del gasto ======
  @Column({ type: 'varchar', length: 150, name: 'nombre_producto' })
  nombre_producto: string;

  @Column({ type: 'text', name: 'descripcion', nullable: true })
  descripcion?: string;

  @Column({ type: 'int', name: 'cantidad', default: 1 })
  cantidad: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'precio' })
  precio: string;

  
  @Column({ type: 'date', name: 'fecha' })
  fecha: string;

  @CreateDateColumn({ type:'timestamp',name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type:'timestamp',name: 'updated_at' })
  updated_at: Date;
}
