import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, RelationId,
} from 'typeorm';
import { Pedido } from './pedido.entity';
import { Producto } from '../productos/producto.entity';
export enum DestinoItem {MESA='MESA',LLEVAR='LLEVAR'}
export enum EstadoItem { PENDIENTE = 'PENDIENTE', LISTO = 'LISTO' }

@Entity('detalles_pedido')
export class DetallePedido {
  @PrimaryGeneratedColumn({ name: 'id_detalle_pedido' })
  id_detalle_pedido: number;

  // FK: id_pedido
  @ManyToOne(() => Pedido, (p) => p.items, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido;

  @RelationId((d: DetallePedido) => d.pedido)
  readonly id_pedido: number;

  @ManyToOne(() => Producto, (pr) => pr.detalles, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @RelationId((d: DetallePedido) => d.producto)
  readonly id_producto: number;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio_unitario: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: string; // cantidad * precio_unitario
  @Column({ type: 'enum', enum: DestinoItem, name: 'destino', nullable: false })
  destino: DestinoItem;
  @Column({ type: 'enum', enum: EstadoItem, default: EstadoItem.PENDIENTE, name: 'estado_item' })
  estado_item: EstadoItem;

}
