import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Pedido } from '../pedidos/pedido.entity';
import { Caja } from '../caja/caja.entity';
import { Gasto } from '../gastos/gasto.entity';

export enum Rol {
  CAJERO = 'CAJERO',
  GERENTE = 'GERENTE',
  COCINA = 'COCINA',
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id_usuario: number;

  @Column()
  nombre: string;

  @Column({ unique: true })
  email: string;

  
  @Column({ select: false })
  contrasena: string;

  @Column({ type: 'enum', enum: Rol })
  rol: Rol;

  @CreateDateColumn({type: 'timestamp', name: 'created_at' })
  created_at: Date;

  @OneToMany(() => Pedido, (p) => p.usuario)
  pedidos: Pedido[];

  @OneToMany(() => Caja, (c) => c.usuario)
  cajas: Caja[];

  @OneToMany(() => Gasto, (g) => g.usuario)
  gastos: Gasto[];
}
