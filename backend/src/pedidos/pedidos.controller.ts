import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { QueryPedidosDto } from './dto/query-pedidos.dto';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { SetEstadoDto } from './dto/set-estado.dto';
import { PagarDto } from './dto/pagar.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';
import { EstadoPedido } from './pedido.entity';

@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PedidosController {
  constructor(private readonly service: PedidosService) {}

  


@Get('cocina')
@Roles('COCINA', 'GERENTE')
async cocinaLista(
  @Query('id_caja') id_caja?: string,
  @Query('estado') estado?: EstadoPedido,
  @Query('desde') desde?: string,
) {
  return this.service.listaParaCocinaPorCaja({
    id_caja: id_caja ? Number(id_caja) : undefined,
    estado,
    desde,
  });
}

@Get('cocina/listos')
@Roles('COCINA', 'GERENTE')
async cocinaListos(@Query('id_caja') id_caja?: string) {
  return this.service.listaParaCocinaPorCaja({
    id_caja: id_caja ? Number(id_caja) : undefined,
    estado: EstadoPedido.LISTO,
  });
}

@Get('cocina/resumen')
@Roles('COCINA', 'GERENTE')
async cocinaResumen(@Query('id_caja') id_caja?: string) {
  return this.service.resumenCocinaPorCaja(id_caja ? Number(id_caja) : undefined);
}



  /** Listar */
  @Get()
  @Roles('GERENTE', 'CAJERO', 'COCINA')
  listar(@Query() q: QueryPedidosDto) {
    if (q.caja !== undefined) (q as any).caja = Number(q.caja);
    if (q.num_mesa !== undefined) (q as any).num_mesa = Number(q.num_mesa);
    if (q.page !== undefined) (q as any).page = Number(q.page);
    if (q.pageSize !== undefined) (q as any).pageSize = Number(q.pageSize);
    return this.service.listar(q);
  }

  /** Crear — CAJERO/GERENTE */
  @Post()
  @Roles('CAJERO', 'GERENTE')
  crear(@Req() req: any, @Body() dto: CreatePedidoDto) {
    console.log('DTO recibido:', dto);
    return this.service.crear(req.user.userId, req.user.rol, dto);
  }

  /** Ver detalle */
  @Get(':id')
  @Roles('GERENTE', 'CAJERO', 'COCINA')
  uno(@Param('id') id: string) {
    return this.service.uno(Number(id));
  }

  /** Editar cabecera / reemplazar ítems — CAJERO/GERENTE */
  @Patch(':id')
  @Roles('CAJERO', 'GERENTE')
  actualizar(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePedidoDto) {
    return this.service.actualizar(req.user.rol, Number(id), dto);
  }

  /** Agregar ítems — CAJERO/GERENTE */
  @Post(':id/items')
  @Roles('CAJERO', 'GERENTE')
  agregarItems(@Param('id') id: string, @Body() dto: AddItemsDto) {
    return this.service.agregarItems(Number(id), dto.items);
  }

  /** Editar un ítem — CAJERO/GERENTE */
  @Patch(':id/items/:detalleId')
  @Roles('CAJERO', 'GERENTE')
  editarItem(@Param('id') id: string, @Param('detalleId') detalleId: string, @Body() dto: UpdateItemDto) {
    return this.service.editarItem(Number(id), Number(detalleId), dto);
  }

  /** Eliminar un ítem — CAJERO/GERENTE */
  @Delete(':id/items/:detalleId')
  @Roles('CAJERO', 'GERENTE')
  eliminarItem(@Param('id') id: string, @Param('detalleId') detalleId: string) {
    return this.service.eliminarItem(Number(id), Number(detalleId));
  }

  /** Cambiar estado del pedido — COCINA/GERENTE */
  @Patch(':id/items/:detalleId/listo')
  @Roles('COCINA', 'GERENTE')
  marcarItemDespachado(@Param('detalleId') detalleId: string) {
    return this.service.marcarItemListo(Number(detalleId));
  }
  
 

  /** Pagar — CAJERO/GERENTE */
  @Patch(':id/pagar')
  @Roles('CAJERO', 'GERENTE')
  pagar(@Param('id') id: string, @Body() dto: PagarDto) {
    return this.service.pagar(Number(id), dto?.metodo);
  }
  @Delete(':id')
  @Roles('GERENTE','CAJERO' )
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(Number(id));
  }
}
