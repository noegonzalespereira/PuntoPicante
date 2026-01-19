import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caja } from './caja.entity';
import { CajaService } from './caja.service';
import { CajaController } from './caja.controller';
import { Pedido } from '../pedidos/pedido.entity';
import { DetallePedido } from '../pedidos/detalle-pedido.entity';
import { Producto } from '../productos/producto.entity';
import { Gasto } from '../gastos/gasto.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Caja, Pedido, DetallePedido, Producto, Gasto]),
  ],
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService],
})
export class CajaModule {}
