import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GastosService } from './gastos.service';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { UpdateGastoDto } from './dto/update-gasto.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';

@Controller('gastos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GastosController {
  constructor(private readonly service: GastosService) {}

  /** Crear gasto — GERENTE y CAJERO */
  @Post()
  @Roles('GERENTE', 'CAJERO')
  create(@Req() req: any, @Body() dto: CreateGastoDto) {
    // req.user viene de JwtStrategy
    return this.service.create(req.user.userId, req.user.rol, dto);
  }

  /** Listar con filtros — GERENTE y CAJERO */
  @Get()
  @Roles('GERENTE', 'CAJERO')
  findAll(
    @Query('caja') caja?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      caja: caja ? Number(caja) : undefined,
      desde,
      hasta,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  /** Ver detalle — GERENTE y CAJERO */
  @Get(':id')
  @Roles('GERENTE', 'CAJERO')
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  /** Editar — GERENTE y CAJERO (solo si caja ABIERTA para cajero) */
  @Patch(':id')
  @Roles('GERENTE', 'CAJERO')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateGastoDto) {
    return this.service.update(req.user.rol, Number(id), dto);
  }

  /** Borrar — solo GERENTE */
  @Delete(':id')
  @Roles('GERENTE')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }

  /** Resumen (suma y cantidad) — GERENTE y CAJERO */
  @Get('utils/resumen')
  @Roles('GERENTE', 'CAJERO')
  resumen(
    @Query('caja') caja?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.resumen({
      caja: caja ? Number(caja) : undefined,
      desde,
      hasta,
    });
  }
}
