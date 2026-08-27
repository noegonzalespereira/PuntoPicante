import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, MoreThanOrEqual, LessThan, In, And } from 'typeorm';
import { Caja, EstadoCaja } from '../caja/caja.entity';
import { Producto, TipoProducto } from '../productos/producto.entity';
import { DestinoItem, DetallePedido,EstadoItem } from './detalle-pedido.entity';
import { Pedido, EstadoPago, EstadoPedido, MetodoPago, TipoPedido } from './pedido.entity';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { QueryPedidosDto } from './dto/query-pedidos.dto';
import { InventarioService } from '../inventario/inventario.service';
import { PedidosGateway } from './pedidos.gateway';

type Rol = 'GERENTE' | 'CAJERO' | 'COCINA' | 'MESERO';

@Injectable()
export class PedidosService {
  constructor(
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    @InjectRepository(DetallePedido) private readonly detalles: Repository<DetallePedido>,
    @InjectRepository(Producto) private readonly productos: Repository<Producto>,
    @InjectRepository(Caja) private readonly cajas: Repository<Caja>,
    private readonly dataSource: DataSource,
    private readonly inventario: InventarioService,
    private readonly gateway: PedidosGateway,
  ) {}

  private parseDateMaybe(v?: string, position: 'start' | 'end' = 'start'): Date | undefined {
    if (!v) return undefined;
    // La cadena 'YYYY-MM-DD' se trata como una fecha en Bolivia.
    // Construimos un objeto Date que represente esto correctamente en UTC para la BD.
    let dateStr: string;
    if (position === 'start') {
      dateStr = `${v}T00:00:00.000-04:00`; // Inicio del día en Bolivia
    } else {
      // Para 'end', calculamos el inicio del DÍA SIGUIENTE en Bolivia.
      // Esto permite usar '<' en la consulta, que es más robusto que 'BETWEEN ... 23:59:59.999'.
      const endDate = new Date(v);
      // Usamos setUTCDate para evitar problemas con cambios de horario de verano locales
      endDate.setUTCDate(endDate.getUTCDate() + 1); // Sumar un día
      const nextDayStr = endDate.toISOString().slice(0, 10); // Formato YYYY-MM-DD del día siguiente
      dateStr = `${nextDayStr}T00:00:00.000-04:00`; // Inicio del día siguiente en Bolivia
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) throw new BadRequestException(`Fecha inválida: ${v}`);
    return d;
  }

  private async preciosPorId(ids: number[]) {
    if (!ids.length) return new Map<number, number>();
    const prods = await this.productos.find({ where: { id_producto: In(ids) } });
    const map = new Map<number, number>();
    for (const p of prods) map.set(p.id_producto, Number(p.precio));
    return map;
  }

  private agregate(items: { id_producto: number; cantidad: number }[]) {
    const agg = new Map<number, number>();
    for (const it of items ?? []) {
      agg.set(it.id_producto, (agg.get(it.id_producto) ?? 0) + Number(it.cantidad));
    }
    return agg;
  }

  private ymd(date?: Date) {
    const d = date ? new Date(date) : new Date();

    // Forzar zona horaria de Bolivia (UTC-4) para consistencia,
    // sin importar la configuración del servidor.
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const boliviaOffset = -4 * 60 * 60000;
    const local = new Date(utc + boliviaOffset);

    // '2023-10-27T14:30:00.000Z' -> '2023-10-27'
    return local.toISOString().slice(0, 10);
  }

  private async recalcularTotal(id_pedido: number, mgr = this.pedidos.manager) {
    const { sum } =
      (await mgr
        .createQueryBuilder(DetallePedido, 'd')
        .select('COALESCE(SUM(d.subtotal), 0)', 'sum')
        .where('d.pedido = :id', { id: id_pedido })
        .getRawOne<{ sum: string }>()) ?? { sum: '0' };

    const p = await mgr.findOneBy(Pedido, { id_pedido });
    if (!p) throw new NotFoundException('Pedido no existe');
    p.total = Number(sum).toFixed(2);
    await mgr.save(p);
    return p.total;
  }

  private tipoDesdeDestinos(destinos: DestinoItem[]): TipoPedido {
    const paraMesa = destinos.includes(DestinoItem.MESA);
    const paraLlevar = destinos.includes(DestinoItem.LLEVAR);
    if (paraMesa && paraLlevar) return TipoPedido.MIXTO;
    return paraMesa ? TipoPedido.MESA : TipoPedido.LLEVAR;
  }

  private async validarTipo_Y_Mesa(id_pedido: number, mgr = this.pedidos.manager) {
    const items = await mgr.find(DetallePedido, { where: { pedido: { id_pedido } } });
    const destinos = items.map(i => i.destino);
    const tipo = this.tipoDesdeDestinos(destinos);
    const p = await mgr.findOneBy(Pedido, { id_pedido });
    if (!p) throw new NotFoundException('Pedido no existe');

    const previo = p.tipo_pedido;
    p.tipo_pedido = tipo;

    if (tipo === TipoPedido.LLEVAR) {
      p.num_mesa = null;
    } else if (tipo === TipoPedido.MESA) {
      if (!p.num_mesa && p.ambiente !== 'OFICINA') throw new BadRequestException('num_mesa es obligatorio para pedidos de MESA');
    }
    if (tipo === TipoPedido.MIXTO) {
      const tieneMesa = destinos.includes(DestinoItem.MESA);
      if (tieneMesa && !p.num_mesa && p.ambiente !== 'OFICINA') throw new BadRequestException('Hay ítems para MESA: num_mesa es obligatorio');
    }

    await mgr.save(p);
    return { tipo_final: tipo, convertidoAMixto: previo !== tipo && tipo === TipoPedido.MIXTO };
  }

  private async reservarStock(
  items: { id_producto: number; cantidad: number }[],
  fechaBase?: Date
) {
  const hoy = this.ymd(fechaBase);
  const agg = this.agregate(items); // Map<id_producto, cantidad total>

  // 1) Traemos los nombres y tipos de TODOS los productos con una sola query
  const ids = Array.from(agg.keys());
  const prods = await this.productos.find({
    where: { id_producto: In(ids) },
    select: ['id_producto', 'nombre', 'tipo'],
  });
  const prodsMap = new Map<number, { nombre: string; tipo: TipoProducto }>(
    prods.map(p => [p.id_producto, { nombre: p.nombre, tipo: p.tipo }])
  );

  // 2) Validamos disponibilidad y, si falta stock, lanzamos error con el nombre
  for (const [id_producto, cant] of agg.entries()) {
    const prodInfo = prodsMap.get(id_producto);

    // SOLO validamos stock para PLATOS. Bebidas y extras tienen stock "infinito".
    if (prodInfo?.tipo === TipoProducto.PLATO) {
      const disponible = await this.inventario.disponibleProducto(id_producto, hoy);
      if (disponible < cant) {
        const nombre = prodInfo.nombre ?? `producto ${id_producto}`;
        throw new BadRequestException(`Stock insuficiente para "${nombre}". Disponible: ${disponible}, solicitado: ${cant}`);
      }
    }
  }

  // 3) Si todo OK, reservamos
  for (const [id_producto, cant] of agg.entries()) {
    await this.inventario.reservar(id_producto, cant, hoy);
  }
}


  private async liberarStock(items: { id_producto: number; cantidad: number }[], fechaBase?: Date) {
    const hoy = this.ymd(fechaBase);
    const agg = this.agregate(items);
    for (const [id_producto, cant] of agg.entries()) {
      await this.inventario.liberar(id_producto, cant, hoy);
    }
  }


  async crear(userId: number, _rol: Rol, dto: CreatePedidoDto) {
    if (!dto.items?.length) throw new BadRequestException('El pedido debe tener al menos un item');

    const caja = await this.cajas.findOne({ where: { id_caja: dto.id_caja } });
    if (!caja) throw new NotFoundException('Caja no existe');
    if (caja.estado !== EstadoCaja.ABIERTA) throw new BadRequestException('La caja no está ABIERTA');

    if (dto.tipo_pedido === TipoPedido.MESA || dto.tipo_pedido === TipoPedido.MIXTO) {
      if (dto.ambiente === 'OFICINA') {
        dto.num_mesa = null;
      } else {
        if (!dto.num_mesa || dto.num_mesa < 1)
          throw new BadRequestException('El número de mesa es obligatorio para pedidos de Patio');
      }
    }
    else {
      dto.num_mesa= null;

    }
    /*estado de pago y metodo de pago */
    if(dto.estado_pago === EstadoPago.PAGADO){
      if(dto.metodo_pago === null || dto.metodo_pago === undefined){
        throw new BadRequestException('Indique el metodo de pago (QR/EFECTIVO)');
      }
    }
    else{
      dto.metodo_pago= null;
    }

    /* Destinos */
    if(dto.tipo_pedido === TipoPedido.LLEVAR){
      dto.items.forEach(i => i.destino = DestinoItem.LLEVAR);
    }
    else if(dto.tipo_pedido === TipoPedido.MESA){
      dto.items.forEach(i => i.destino = DestinoItem.MESA);
    }

    
    /*Calcular precios y reservar stock*/

    const ids = [...new Set(dto.items.map(i => i.id_producto))];
    const precioPorId = await this.preciosPorId(ids);

    await this.reservarStock(dto.items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })), new Date());

    // Determinar el estado inicial del pedido. Si no tiene platos, se marca como LISTO.
    const productosConTipo = await this.productos.find({
      where: { id_producto: In(ids) },
      select: ['id_producto', 'tipo'],
    });
    const tienePlatos = productosConTipo.some(p => p.tipo === TipoProducto.PLATO);
    const estadoPedidoInicial = tienePlatos ? EstadoPedido.PENDIENTE : EstadoPedido.LISTO;
    const estadoItemInicial = tienePlatos ? EstadoItem.PENDIENTE : EstadoItem.LISTO;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const it of dto.items) {
        if (!it.destino && dto.tipo_pedido === TipoPedido.MIXTO)
          throw new BadRequestException('En pedidos MIXTOS, cada ítem debe tener destino (MESA o LLEVAR)');
      }

      /* num_pedido correlativo dentro de la caja actual — sin rangos de fecha */
      const [maxRow] = await qr.query(
        `SELECT COALESCE(MAX(num_pedido), 0) AS max FROM pedido WHERE id_caja = $1`,
        [dto.id_caja],
      );
      const num_pedido = Number(maxRow?.max ?? 0) + 1;

      const pedido = await qr.manager.save(Pedido, {
        num_pedido,
        usuario: { id_usuario: userId },
        caja: { id_caja: dto.id_caja },
        tipo_pedido: dto.tipo_pedido,
        num_mesa: dto.num_mesa,
        ambiente: dto.ambiente ?? 'PATIO',
        nombre_cliente: dto.nombre_cliente ?? null,
        metodo_pago: dto.metodo_pago,
        estado_pago: dto.estado_pago,
        estado_pedido: estadoPedidoInicial,
        total: '0.00',
      });

      for (const it of dto.items) {
        const precio = precioPorId.get(it.id_producto);
        if (precio === undefined) throw new BadRequestException(`Producto ${it.id_producto} no existe`);
        const subtotal = Number(precio * it.cantidad);
        const destino: DestinoItem =
          it.destino ?? (dto.tipo_pedido === TipoPedido.LLEVAR ? DestinoItem.LLEVAR : DestinoItem.MESA);

        await qr.manager.save(DetallePedido, {
          pedido: { id_pedido: pedido.id_pedido },
          producto: { id_producto: it.id_producto },
          cantidad: it.cantidad,
          precio_unitario: precio.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notas: it.notas ?? null,
          destino,
          estado_item: estadoItemInicial,
        });
      }

      // const { tipo_final, convertidoAMixto } = await this.validarTipo_Y_Mesa(pedido.id_pedido, qr.manager);
      const tipoFinal = await this.validarTipo_Y_Mesa(pedido.id_pedido,qr.manager);
      const total = await this.recalcularTotal(pedido.id_pedido, qr.manager);
      await qr.commitTransaction();
      this.gateway.emitNuevoPedido({ id_pedido: pedido.id_pedido, num_pedido: pedido.num_pedido, ambiente: pedido.ambiente, num_mesa: pedido.num_mesa, nombre_cliente: pedido.nombre_cliente });
      return { id_pedido: pedido.id_pedido, num_pedido: pedido.num_pedido, total, tipo_pedido: pedido.tipo_pedido, convertidoAMixto:false };
    } catch (e) {
      await qr.rollbackTransaction();
      await this.liberarStock(dto.items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })), new Date());
      throw e;
    } finally {
      await qr.release();
    }
  }


  async actualizar(_rol: Rol, id_pedido: number, dto: UpdatePedidoDto) {
    const p = await this.pedidos.findOne({
      where: { id_pedido },
      relations: { items: { producto: true } },
      order: { items: { id_detalle_pedido: 'ASC' } },
    });
    if (!p) throw new NotFoundException('Pedido no existe');

    if (dto.tipo_pedido !== undefined) p.tipo_pedido = dto.tipo_pedido;
    if (dto.num_mesa !== undefined) p.num_mesa = dto.num_mesa as any;
    if (dto.ambiente !== undefined) p.ambiente = dto.ambiente;
    if (dto.nombre_cliente !== undefined) p.nombre_cliente = dto.nombre_cliente;
    if (dto.metodo_pago !== undefined) p.metodo_pago = dto.metodo_pago;

    if (!dto.items) {
      await this.pedidos.save(p);
      const { tipo_final, convertidoAMixto } = await this.validarTipo_Y_Mesa(id_pedido);
      this.gateway.emitPedidoActualizado({ id_pedido, tipo_pedido: tipo_final });
      return { ok: true, tipo_pedido: tipo_final, convertidoAMixto };
    }

    const oldAgg = this.agregate(p.items.map(d => ({ id_producto: d.producto.id_producto, cantidad: d.cantidad })));
    const newAgg = this.agregate(dto.items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })));

    const productosIds = Array.from(new Set([...oldAgg.keys(), ...newAgg.keys()]));
    const deltaPos: { id_producto: number; cantidad: number }[] = [];
    const deltaNeg: { id_producto: number; cantidad: number }[] = [];

    for (const id of productosIds) {
      const antes = oldAgg.get(id) ?? 0;
      const ahora = newAgg.get(id) ?? 0;
      const delta = ahora - antes;
      if (delta > 0) deltaPos.push({ id_producto: id, cantidad: delta });
      else if (delta < 0) deltaNeg.push({ id_producto: id, cantidad: -delta });
    }

    if (deltaPos.length) await this.reservarStock(deltaPos, p.created_at);
    if (deltaNeg.length) await this.liberarStock(deltaNeg, p.created_at);

    const idsNuevos = [...new Set(dto.items.map(i => i.id_producto))];
    const precioPorId = await this.preciosPorId(idsNuevos);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      if (dto.tipo_pedido !== undefined) p.tipo_pedido = dto.tipo_pedido;
      if (dto.num_mesa !== undefined) p.num_mesa = dto.num_mesa as any;
      if (dto.metodo_pago !== undefined) p.metodo_pago = dto.metodo_pago;
      await qr.manager.save(p);
      // delete (p as any).items;
      // await qr.manager
      // .createQueryBuilder()
      // .delete()
      // .from(DetallePedido)
      // .where("id_pedido = :id", { id: id_pedido })
      // .execute();
      await qr.manager.delete(DetallePedido, {pedido: {id_pedido}});
      for (const it of dto.items) {
        const precio = precioPorId.get(it.id_producto);
        if (precio === undefined) throw new BadRequestException(`Producto ${it.id_producto} no existe`);
        const subtotal = Number(precio * it.cantidad);
        if (!it.destino && p.tipo_pedido === TipoPedido.MIXTO)
          throw new BadRequestException('En pedidos MIXTOS, cada ítem debe tener destino (MESA o LLEVAR)');
        const destino: DestinoItem =
          it.destino ?? (p.tipo_pedido === TipoPedido.LLEVAR ? DestinoItem.LLEVAR : DestinoItem.MESA);

        await qr.manager.save(DetallePedido, {
          pedido: { id_pedido },
          producto: { id_producto: it.id_producto },
          cantidad: it.cantidad,
          precio_unitario: precio.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notas: it.notas ?? null,
          destino,
          estado_item: it.estado_item ?? EstadoItem.PENDIENTE,
        });
      }

      // p.estado_pedido = EstadoPedido.PENDIENTE;
      // await qr.manager.save(p);
      // const { tipo_final, convertidoAMixto } = await this.validarTipo_Y_Mesa(id_pedido, qr.manager);
      const tipoFinal = await this.validarTipo_Y_Mesa(id_pedido,qr.manager);
      await this.recalcularEstadoPedido(id_pedido,qr.manager);
      const total = await this.recalcularTotal(id_pedido, qr.manager);
      await qr.commitTransaction();
      this.gateway.emitPedidoActualizado({ id_pedido });
      return { ok: true, total, tipo_pedido: tipoFinal.tipo_final, convertidoAMixto: tipoFinal.convertidoAMixto };
    } catch (e) {
      await qr.rollbackTransaction();
      if (deltaPos.length) await this.liberarStock(deltaPos, p.created_at);
      if (deltaNeg.length) await this.reservarStock(deltaNeg, p.created_at);
      throw e;
    } finally {
      await qr.release();
    }
  }

  async agregarItems(id_pedido: number, items: { id_producto: number; cantidad: number; notas?: string; destino?: DestinoItem ;estado_item?: EstadoItem}[], prioritario = false) {
    if (!items?.length) throw new BadRequestException('Debes enviar al menos un ítem');
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    const updatedAtOriginal = p.updated_at; // Guardar timestamp original

    await this.reservarStock(items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })), p.created_at);

    const ids = [...new Set(items.map(i => i.id_producto))];
    const precioPorId = await this.preciosPorId(ids);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      for (const it of items) {
        const precio = precioPorId.get(it.id_producto);
        if (precio === undefined) throw new BadRequestException(`Producto ${it.id_producto} no existe`);
        const subtotal = Number(precio * it.cantidad);
        if (!it.destino && p.tipo_pedido === TipoPedido.MIXTO)
          throw new BadRequestException('En pedidos MIXTOS, cada ítem debe tener destino (MESA o LLEVAR)');
        const destino: DestinoItem =
          it.destino ?? (p.tipo_pedido === TipoPedido.LLEVAR ? DestinoItem.LLEVAR : DestinoItem.MESA);

        await qr.manager.save(DetallePedido, {
          pedido: { id_pedido },
          producto: { id_producto: it.id_producto },
          cantidad: it.cantidad,
          precio_unitario: precio.toFixed(2),
          subtotal: subtotal.toFixed(2),
          notas: it.notas ?? null,
          destino,
          estado_item: EstadoItem.PENDIENTE,
        });
      }

      // Forzamos el estado a PENDIENTE porque se están añadiendo nuevos items.
      // Esto asegura que un pedido LISTO o ENTREGADO vuelva a la cola de cocina.
      p.estado_pedido = EstadoPedido.PENDIENTE;
      p.prioritario = prioritario;
      await qr.manager.save(p);
      const { tipo_final, convertidoAMixto } = await this.validarTipo_Y_Mesa(id_pedido, qr.manager);

      const total = await this.recalcularTotal(id_pedido, qr.manager);

      if (!prioritario) {
        await qr.manager.createQueryBuilder()
          .update(Pedido)
          .set({ updated_at: updatedAtOriginal, prioritario: false })
          .where("id_pedido = :id_pedido", { id_pedido })
          .execute();
      }

      await qr.commitTransaction();
      this.gateway.emitPedidoActualizado({ id_pedido });
      return { ok: true, total, tipo_pedido: tipo_final, convertidoAMixto };
    } catch (e) {
      await qr.rollbackTransaction();
      await this.liberarStock(items.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })), p.created_at);
      throw e;
    } finally {
      await qr.release();
    }
  }

  async editarItem(id_pedido: number, id_detalle: number, dto: { cantidad?: number; notas?: string | null; destino?: DestinoItem ,estado_item?:EstadoItem}) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');

    const d = await this.detalles.findOne({
      where: { id_detalle_pedido: id_detalle, pedido: { id_pedido } },
      relations: { producto: true },
    });
    if (!d) throw new NotFoundException('Detalle no encontrado');

    if (dto.cantidad !== undefined) {
      if (!Number.isInteger(dto.cantidad) || dto.cantidad < 1)
        throw new BadRequestException('Cantidad inválida');
      const delta = dto.cantidad - d.cantidad;
      if (delta > 0)
        await this.reservarStock([{ id_producto: d.producto.id_producto, cantidad: delta }], p.created_at);
      else if (delta < 0)
        await this.liberarStock([{ id_producto: d.producto.id_producto, cantidad: -delta }], p.created_at);
      d.cantidad = dto.cantidad;
      d.subtotal = (Number(d.precio_unitario) * d.cantidad).toFixed(2);
    }

    if (dto.notas !== undefined) d.notas = dto.notas;
    if (dto.destino !== undefined) d.destino = dto.destino;
    if (dto.estado_item != undefined) d.estado_item=dto.estado_item;

    await this.detalles.save(d);
    await this.recalcularEstadoPedido(id_pedido);
    // p.estado_pedido = EstadoPedido.PENDIENTE;
    // await this.pedidos.save(p);
    const { tipo_final, convertidoAMixto } = await this.validarTipo_Y_Mesa(id_pedido);
    const total = await this.recalcularTotal(id_pedido);
    this.gateway.emitPedidoActualizado({ id_pedido });
    return { ok: true, total, tipo_pedido: tipo_final, convertidoAMixto };
  }

  async eliminarItem(id_pedido: number, id_detalle: number) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');

    const d = await this.detalles.findOne({
      where: { id_detalle_pedido: id_detalle, pedido: { id_pedido } },
      relations: { producto: true },
    });
    if (!d) throw new NotFoundException('Detalle no encontrado');

    await this.liberarStock([{ id_producto: d.producto.id_producto, cantidad: d.cantidad }], p.created_at);
    await this.detalles.delete({ id_detalle_pedido: id_detalle, pedido: { id_pedido } });

    // p.estado_pedido = EstadoPedido.PENDIENTE;
    // await this.pedidos.save(p);
    await this.recalcularEstadoPedido(id_pedido);
    const { tipo_final, convertidoAMixto } = await this.validarTipo_Y_Mesa(id_pedido);
    const total = await this.recalcularTotal(id_pedido);
    this.gateway.emitPedidoActualizado({ id_pedido });
    return { ok: true, total, tipo_pedido: tipo_final, convertidoAMixto };
  }



  async pagar(id_pedido: number, metodo?: MetodoPago) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO)
      throw new BadRequestException('El pedido ya está pagado');

    p.metodo_pago = metodo ?? MetodoPago.EFECTIVO;
    p.estado_pago = EstadoPago.PAGADO;
    await this.pedidos.save(p);
    return { ok: true, estado_pago: p.estado_pago, metodo_pago: p.metodo_pago };
  }

  async eliminar(id_pedido: number) {
    const p = await this.pedidos.findOne({
      where: { id_pedido },
      relations: { items: { producto: true } },
    });
    if (!p) throw new NotFoundException('Pedido no existe');
    if (p.estado_pago === EstadoPago.PAGADO)
      throw new ForbiddenException('No se puede eliminar un pedido PAGADO');

    const devolver = p.items.map(d => ({ id_producto: d.producto.id_producto, cantidad: d.cantidad }));
    if (devolver.length) await this.liberarStock(devolver, p.created_at);
    await this.pedidos.delete(id_pedido);
    return { ok: true };
  }

  async uno(id_pedido: number) {
    const p = await this.pedidos.findOne({
      where: { id_pedido },
      relations: { usuario: true, items: { producto: true } },
      order: { items: { id_detalle_pedido: 'ASC' } },
    });
    if (!p) throw new NotFoundException('Pedido no existe');
    return p;
  }

  async listar(q: QueryPedidosDto) {
    //mostrar pedidos de caja abierta
    const cajaAbierta = await this.cajas.findOne({
      where: { estado: EstadoCaja.ABIERTA },
    });

    if (cajaAbierta) {
      q.caja = cajaAbierta.id_caja;
    }

    const where: any = {};
    if (q.caja) where.caja = { id_caja: q.caja };
    if (q.tipo_pedido) where.tipo_pedido = q.tipo_pedido as any;
    if (q.num_mesa !== undefined) where.num_mesa = q.num_mesa;
    if (q.estado_pago) where.estado_pago = q.estado_pago;
    if (q.estado_pedido) where.estado_pedido = q.estado_pedido;
    if (q.metodo_pago) where.metodo_pago = q.metodo_pago;
    if (q.ambiente) where.ambiente = q.ambiente;

    const ini = this.parseDateMaybe(q.desde, 'start');
    const fin = this.parseDateMaybe(q.hasta, 'end');

    if (ini && fin) {
      where.created_at = And(MoreThanOrEqual(ini), LessThan(fin));
    } else if (ini) {
      where.created_at = MoreThanOrEqual(ini);
    } else if (fin) {
      where.created_at = LessThan(fin);
    }

    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(q.pageSize ?? 50)));

    const [rows, total] = await this.pedidos.findAndCount({
      where,
      order: { id_pedido: 'DESC' },
      relations: { items: true },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    return { total, page, pageSize, data: rows };
  }
  // imports necesarios arriba:
// import { EstadoPedido } from './pedido.entity';
// import { In } from 'typeorm';

async listaParaCocinaPorCaja(opts: { id_caja?: number; estado?: EstadoPedido; desde?: string }) {
  const where: any = {};

  // Solo cocina trabaja con PENDIENTE/LISTO
  const estadosBase = [EstadoPedido.PENDIENTE, EstadoPedido.LISTO];

  if (opts.estado) {
    where.estado_pedido = opts.estado;
  } else {
    where.estado_pedido = In(estadosBase);
  }

  if (opts.id_caja) {
    where.caja = { id_caja: opts.id_caja };
  } else {
    // fallback: si NO te mandan id_caja, intentamos la caja abierta
    const abierta = await this.cajas.findOne({ where: { estado: EstadoCaja.ABIERTA } });
    if (abierta) where.caja = { id_caja: abierta.id_caja };
  }

  if (opts.desde) {
    const d = this.parseDateMaybe(opts.desde);
    if (d) where.updated_at = MoreThanOrEqual(d);
  }

  const pedidos = await this.pedidos.find({
    where,
    relations: { items: { producto: true } },
    order: { updated_at: 'ASC', id_pedido: 'ASC' },
  });

  // Inyectar el stock disponible actual para cada producto en la respuesta.
  // Esto es útil para que la UI (ej. vista de mesero) pueda mostrarlo.
  const hoy = this.ymd();
  const stockInfo = await this.inventario.disponible({ fecha: hoy });
  const stockMap = new Map<number, number>();
  stockInfo.platos.forEach(p => stockMap.set(p.id_producto, p.stock));
  stockInfo.bebidas.forEach(p => stockMap.set(p.id_producto, p.stock));
  stockInfo.extras.forEach(p => stockMap.set(p.id_producto, p.stock));

  // Mapeamos a objetos planos para añadir la propiedad `stock_disponible` sin mutar las entidades.
  return pedidos.map(pedido => {
    const plainPedido = { ...pedido };
    plainPedido.items = pedido.items.map(item => {
      const plainItem = { ...item };
      if (plainItem.producto) {
        plainItem.producto = {
          ...plainItem.producto,
          stock_disponible: stockMap.get(item.producto.id_producto) ?? 0,
        } as any;
      }
      return plainItem;
    });
    return plainPedido;
  });
}

async resumenCocinaPorCaja(id_caja?: number) {
  let whereBase: any = {};
  if (id_caja) {
    whereBase.caja = { id_caja };
  } else {
    const abierta = await this.cajas.findOne({ where: { estado: EstadoCaja.ABIERTA } });
    if (abierta) whereBase.caja = { id_caja: abierta.id_caja };
  }

  const [pendientes, listos] = await Promise.all([
    this.pedidos.count({ where: { ...whereBase, estado_pedido: EstadoPedido.PENDIENTE } }),
    this.pedidos.count({ where: { ...whereBase, estado_pedido: EstadoPedido.LISTO } }),
  ]);

  return { pendientes, listos };
}


  // async listaParaCocina(desde?: string) {
  //   const d = this.parseDateMaybe(desde);
  //   const where: any = { estado_pedido: In([EstadoPedido.PENDIENTE, EstadoPedido.LISTO]) };
  //   if (d) where.updated_at = MoreThanOrEqual(d);

  //   return this.pedidos.find({
  //     where,
  //     relations: { items: { producto: true } },
  //     order: { updated_at: 'ASC', id_pedido: 'ASC' },
  //   });
  // }
  
//   async listaParaCocina(opts?: { desde?: string; id_caja?: number }) {
//     const d = this.parseDateMaybe(opts?.desde);

//     // Determinar caja objetivo
//     let id_caja = opts?.id_caja;
//     if (!id_caja) {
//       const cajaAbierta = await this.cajas.findOne({ where: { estado: EstadoCaja.ABIERTA } });
//       if (!cajaAbierta) return []; // sin caja abierta => no hay feed de cocina
//       id_caja = cajaAbierta.id_caja;
//     }

//     // Filtro base: solo PENDIENTE/LISTO de la caja actual
//     const where: any = {
//       estado_pedido: In([EstadoPedido.PENDIENTE, EstadoPedido.LISTO]),
//       caja: { id_caja },
//     };
//     if (d) where.updated_at = MoreThanOrEqual(d);

//     return this.pedidos.find({
//       where,
//       relations: { items: { producto: true } },
//       order: { updated_at: 'ASC', id_pedido: 'ASC' },
//     });
//   }
//   async resumenParaCocina(opts?: { id_caja?: number }) {
//   // Determinar caja
//   let id_caja = opts?.id_caja;
//   if (!id_caja) {
//     const cajaAbierta = await this.cajas.findOne({ where: { estado: EstadoCaja.ABIERTA } });
//     if (!cajaAbierta) return { pendientes: 0, listos: 0 };
//     id_caja = cajaAbierta.id_caja;
//   }

//   // Agrega group by por estado, filtrado por caja
//   const rows = await this.pedidos.createQueryBuilder('p')
//     .select('p.estado_pedido', 'estado')
//     .addSelect('COUNT(1)', 'cantidad')
//     .where('p.cajaIdCaja = :id_caja', { id_caja }) // o "p.caja = :id_caja" según tu FK; ver nota abajo
//     .andWhere('p.estado_pedido IN (:...estados)', { estados: [EstadoPedido.PENDIENTE, EstadoPedido.LISTO] })
//     .groupBy('p.estado_pedido')
//     .getRawMany();

//   const map = Object.fromEntries(rows.map(r => [r.estado, Number(r.cantidad)]));
//   return {
//     pendientes: map[EstadoPedido.PENDIENTE] ?? 0,
//     listos: map[EstadoPedido.LISTO] ?? 0,
//   };
// }


  
  private async recalcularEstadoPedido(id_pedido: number, mgr = this.pedidos.manager) {
      const items = await mgr.find(DetallePedido, { 
          where: { pedido: { id_pedido } } 
      });
      let nuevoEstado: EstadoPedido;
      if (items.length === 0) {
        nuevoEstado=EstadoPedido.LISTO;
      }else{
        const tienePendientes = items.some(i => i.estado_item === EstadoItem.PENDIENTE);
        nuevoEstado = tienePendientes ? EstadoPedido.PENDIENTE : EstadoPedido.LISTO;
        
      }

      // Usamos queryBuilder.update para cambiar solo el estado sin afectar updated_at.
      // Esto evita que el pedido se marque como "prioritario" solo porque un ítem se marcó como listo.
      await mgr.createQueryBuilder()
        .update(Pedido)
        .set({ estado_pedido: nuevoEstado })
        .where("id_pedido = :id_pedido", { id_pedido })
        .execute();

      // await mgr.update(Pedido,{id_pedido},{estado_pedido:nuevoEstado})
      return nuevoEstado;
  }

  async marcarPedidoEntregado(id_pedido: number) {
    const p = await this.pedidos.findOne({ where: { id_pedido } });
    if (!p) throw new NotFoundException('Pedido no existe');

    p.estado_pedido = EstadoPedido.ENTREGADO;
    await this.pedidos.save(p);
    this.gateway.emitPedidoEntregado(id_pedido);
    return { ok: true, estado_pedido: p.estado_pedido };
  }

  async marcarItemListo(id_detalle: number) {
      const detalle = await this.detalles.findOne({ 
          where: { id_detalle_pedido: id_detalle },
          relations: { pedido: true }
      });
      if (!detalle) throw new NotFoundException('Detalle no encontrado');
      if (detalle.estado_item === 'LISTO') return { ok: true, mensaje: 'Ya estaba listo' }; 

      //Marcar ítem como LISTO y guardar
      detalle.estado_item = EstadoItem.LISTO;
      await this.detalles.save(detalle);
      const nuevoEstadoResumen= await this.recalcularEstadoPedido(detalle.pedido.id_pedido);
      this.gateway.emitItemListo({ id_pedido: detalle.pedido.id_pedido, id_detalle });

      return { ok: true, id_detalle, estado_pedido_resumen:nuevoEstadoResumen };
  }
}
