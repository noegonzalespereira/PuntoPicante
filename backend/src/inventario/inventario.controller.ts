import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { AperturaPlatosDto } from './dto/apertura-platos.dto';
import { IngresoBebidaDto } from './dto/ingreso-bebida.dto';
import { MermaDto } from './dto/merma.dto';
import { QueryDisponibleDto } from './dto/query-disponible.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';

@Controller('inventario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventarioController {
  constructor(private readonly service: InventarioService) {}

  /** Ver disponibilidad combinada (platos del día + bebidas global) */
  @Get('disponible')
  @Roles('GERENTE', 'CAJERO', 'COCINA')
  disponible(@Query() q: QueryDisponibleDto) {
    return this.service.disponible(q);
  }

  /** Apertura diaria de platos (define cupo por producto para la fecha) */
  @Post('apertura-platos')
  @Roles('GERENTE')
  aperturaPlatos(@Body() dto: AperturaPlatosDto) {
    return this.service.aperturaPlatos(dto);
  }

  /** Ingreso de stock para bebidas (global) */
  @Post('ingreso-bebida')
  @Roles('GERENTE')
  ingresoBebida(@Body() dto: IngresoBebidaDto) {
    return this.service.ingresoBebida(dto);
  }

  /** Merma (plato por fecha o bebida global) */
  @Post('merma')
  @Roles('GERENTE')
  merma(@Body() dto: MermaDto) {
    return this.service.merma(dto);
  }
  @Get('merma')
  @Roles('GERENTE')
  listarMermas() {
    return this.service.listarMermas();
  }
  // Obtener desglose de stock del día (platos + bebidas)
  @Get('disponible-detalles')
  @Roles('GERENTE', 'CAJERO', 'COCINA')
  getDesgloseStockDelDia(@Query('fecha') fecha: string) {
      return this.service.getDesgloseStockDelDia(fecha);
  }
}
