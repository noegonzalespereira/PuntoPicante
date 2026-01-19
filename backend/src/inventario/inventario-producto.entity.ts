import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  RelationId,
} from 'typeorm';
import { Producto } from '../productos/producto.entity';
import { InventarioMovimiento } from './inventario-mov.entity';

export enum ModoInventario {
  PLATO = 'PLATO',   
  BEBIDA = 'BEBIDA', 
}

@Entity('inventario_producto')
export class InventarioProducto {
  @PrimaryGeneratedColumn({ name: 'id_inventario' })
  id_inventario: number;

  @ManyToOne(() => Producto, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @RelationId((i: InventarioProducto) => i.producto)
  readonly id_producto: number;

  @Column({ type: 'enum', enum: ModoInventario, name: 'modo' })
  modo: ModoInventario;

  /**
   * Fecha de vigencia:
   * - PLATO: fecha del día (YYYY-MM-DD)
   * - BEBIDA: NULL (stock global)
   */
  @Column({ type: 'date', name: 'fecha', nullable: true })
  fecha: string | null;

  /** Cantidad disponible (cupo inicial y luego se va descontando con ventas/mermas) */
  @Column({ type: 'int', name: 'cantidad_inicial' })
  cantidad_inicial: number;

  @Column({ type: 'text', name: 'notas', nullable: true })
  notas?: string | null;

  @CreateDateColumn({ type: 'timestamp',name: 'created_at' })
  created_at: Date;

  /** Movimientos asociados (INGRESO / MERMA) */
  @OneToMany(() => InventarioMovimiento, (m) => m.inventario)
  movimientos: InventarioMovimiento[];
}
