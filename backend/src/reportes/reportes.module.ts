import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

import { DetallePedido } from '../pedidos/detalle-pedido.entity';
import { Pedido } from '../pedidos/pedido.entity';
import { Producto } from '../productos/producto.entity';



import { InventarioMovimiento } from '../inventario/inventario-mov.entity';
import { InventarioProducto } from '../inventario/inventario-producto.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DetallePedido,
      Pedido,
      Producto,
      
      InventarioMovimiento,
      InventarioProducto,
    ]),
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
