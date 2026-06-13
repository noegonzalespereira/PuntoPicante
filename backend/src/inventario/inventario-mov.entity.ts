import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { InventarioProducto } from './inventario-producto.entity';

export enum TipoMovimiento {
  INGRESO    = 'INGRESO',     // entró stock (apertura de platos / ingreso de bebidas)
  VENTA      = 'VENTA',       // salió stock por una venta
  DEVOLUCION = 'DEVOLUCION',  // volvió stock por anulación o reducción de un pedido
  MERMA      = 'MERMA',       // se perdió stock (mala preparación, caducidad, etc.)
}

@Entity('inventario_mov')
export class InventarioMovimiento {
  @PrimaryGeneratedColumn()
  id_mov: number;

  @ManyToOne(() => InventarioProducto, i => i.movimientos, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_inventario' })
  inventario: InventarioProducto;

  @Column({ type: 'enum', enum: TipoMovimiento })
  tipo: TipoMovimiento;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  motivo: string | null;

  @CreateDateColumn({ type: 'timestamp',name: 'created_at' })
  created_at: Date;
}
