import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn, RelationId,
} from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { Caja } from '../caja/caja.entity';
import { DetallePedido } from './detalle-pedido.entity';

export enum TipoPedido   { MESA = 'MESA', LLEVAR = 'LLEVAR',MIXTO='MIXTO' }
export enum MetodoPago   { EFECTIVO = 'EFECTIVO', QR = 'QR' }
export enum EstadoPago   { SIN_PAGAR = 'SIN_PAGAR', PAGADO = 'PAGADO' }
export enum EstadoPedido {PENDIENTE='PENDIENTE',LISTO='LISTO'}
@Entity('pedido')
export class Pedido {
  @PrimaryGeneratedColumn({ name: 'id_pedido' })
  id_pedido: number;
  
  @Column({ type: 'int', name: 'num_pedido' })
  num_pedido: number;

  // FK: id_usuario
  @ManyToOne(() => Usuario, (u) => u.pedidos, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @RelationId((p: Pedido) => p.usuario)
  readonly id_usuario: number;

  // FK: id_caja
  @ManyToOne(() => Caja, (c) => c.pedidos, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_caja' })
  caja: Caja;

  @RelationId((p: Pedido) => p.caja)
  readonly id_caja: number;

  @Column({ type: 'enum', enum: TipoPedido, name: 'tipo_pedido' })
  tipo_pedido: TipoPedido;

  @Column({ type: 'int', nullable: true, name: 'num_mesa' })
  num_mesa: number | null;

  @Column({ type: 'enum', enum: MetodoPago, name: 'metodo_pago', nullable:true,default:null })
  metodo_pago: MetodoPago | null;

  @Column({ type: 'enum', enum: EstadoPago, default: EstadoPago.SIN_PAGAR, name: 'estado_pago' })
  estado_pago: EstadoPago;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total' })
  total: string;
  @Column({ type: 'enum', enum: EstadoPedido, default: EstadoPedido.PENDIENTE, name: 'estado_pedido' })
  estado_pedido: EstadoPedido;
 

  @CreateDateColumn({ type: 'timestamp',name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp',name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => DetallePedido, (d) => d.pedido, {
  cascade: ['insert'], 
  orphanedRowAction: 'delete',
  })
  items: DetallePedido[];

}
