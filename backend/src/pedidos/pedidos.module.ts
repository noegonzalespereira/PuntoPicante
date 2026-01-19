import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { Pedido } from './pedido.entity';
import { DetallePedido } from './detalle-pedido.entity';
import { Producto } from '../productos/producto.entity';
import { Caja } from '../caja/caja.entity';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido, DetallePedido, Producto, Caja]),InventarioModule],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
