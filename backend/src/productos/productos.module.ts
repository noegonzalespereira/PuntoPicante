import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './producto.entity';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
@Module({
  imports: [TypeOrmModule.forFeature([Producto]), CloudinaryModule],

  controllers: [ProductosController],
  providers: [ProductosService],
  exports: [ProductosService],
})
export class ProductosModule {}
