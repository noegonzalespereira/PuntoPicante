import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { DetallePedido } from '../pedidos/detalle-pedido.entity';

export enum TipoProducto { PLATO='PLATO', BEBIDA='BEBIDA' }

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn() id_producto: number;
  @Column() nombre: string;
  @Column({ type: 'enum', enum: TipoProducto }) tipo: TipoProducto;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) precio: string;
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'img_url' })
  img_url: string | null;
  @Column({ type: 'smallint', default: 1 }) activo: number;
  @CreateDateColumn({ type: 'timestamp',name: 'created_at' }) created_at: Date;

  @OneToMany(() => DetallePedido, d => d.producto) detalles: DetallePedido[];
}
