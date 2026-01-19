import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn,CreateDateColumn } from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';
import { Pedido } from '../pedidos/pedido.entity';
import { Gasto } from '../gastos/gasto.entity';

export enum EstadoCaja { ABIERTA='ABIERTA', CERRADA='CERRADA' }

@Entity('caja')
export class Caja {
  @PrimaryGeneratedColumn() id_caja: number;

  @ManyToOne(() => Usuario, u => u.cajas) 
  @JoinColumn({ name: 'id_usuario' }) usuario: Usuario;
  @Column() id_usuario: number;

  @Column({ type: 'enum', enum: EstadoCaja, default: EstadoCaja.ABIERTA }) 
  estado: EstadoCaja;
 @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_apertura: Date;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) 
  monto_apertura: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) 
  monto_cierre: string | null;
  @Column({ type: 'timestamp', nullable: true }) 
  fecha_cierre: Date | null;

  @OneToMany(() => Pedido, p => p.caja) 
  pedidos: Pedido[];
  @OneToMany(() => Gasto, g => g.caja) 
  gastos: Gasto[];
}
