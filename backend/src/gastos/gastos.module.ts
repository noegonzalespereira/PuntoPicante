import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GastosController } from './gastos.controller';
import { GastosService } from './gastos.service';
import { Gasto } from './gasto.entity';
import { Caja } from '../caja/caja.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Gasto, Caja])],
  controllers: [GastosController],
  providers: [GastosService],
  exports: [GastosService],
})
export class GastosModule {}
