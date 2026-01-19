import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioProducto } from './inventario-producto.entity';
import { InventarioMovimiento } from './inventario-mov.entity';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';
import { Producto } from '../productos/producto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventarioProducto, InventarioMovimiento, Producto])],
  providers: [InventarioService],
  controllers: [InventarioController],
  exports: [InventarioService],
})
export class InventarioModule {}
