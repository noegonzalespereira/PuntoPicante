import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';

import { DetallePedido } from '../pedidos/detalle-pedido.entity';
import { Pedido } from '../pedidos/pedido.entity';
import { Producto, TipoProducto } from '../productos/producto.entity';



import { InventarioMovimiento, TipoMovimiento } from '../inventario/inventario-mov.entity';
import { InventarioProducto } from '../inventario/inventario-producto.entity';
import { ReportRangeDto } from './dto/report-range.dto';

type RangoFechasCaja = { desde?: string; hasta?: string; caja?: number };
type RangoFechas = { desde?: string; hasta?: string };

type DetalleUtilidad = {
  id_producto: number;
  nombre: string;
  tipo: string;
  unidades: number;
  ventas: string;                  // 2 decimales
  costo_unitario_teorico: string;  // 4 decimales
  costo_total_teorico: string;     // 2 decimales
  margen: string;                  // 2 decimales
};

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(DetallePedido) private readonly detRepo: Repository<DetallePedido>,
    @InjectRepository(Pedido) private readonly pedRepo: Repository<Pedido>,
    @InjectRepository(Producto) private readonly prodRepo: Repository<Producto>,
    
    @InjectRepository(InventarioMovimiento) private readonly movRepo: Repository<InventarioMovimiento>,
    @InjectRepository(InventarioProducto) private readonly invRepo: Repository<InventarioProducto>,
  ) {}

  // --- Helpers de fechas ---
  private parseDateMaybe(v?: string): Date | undefined {
    if (!v) return undefined;
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
    return d;
  }

  private buildBetween(desde?: string, hasta?: string) {
    const d1 = this.parseDateMaybe(desde);
    const d2 = this.parseDateMaybe(hasta);
    if (d1 && d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      return Between(d1, end);
    } else if (d1) {
      return MoreThanOrEqual(d1);
    } else if (d2) {
      const end = new Date(d2);
      if (end.getHours() === 0 && end.getMinutes() === 0) end.setHours(23, 59, 59, 999);
      return LessThanOrEqual(end);
    }
    return undefined;
  }

  
  // --- Ventas agrupadas por producto (unidades y ventas $) ---
  private async ventasAgrupadas(q: RangoFechasCaja) {
    const qb = this.detRepo
      .createQueryBuilder('d')
      .innerJoin('d.pedido', 'p')
      .innerJoin('d.producto', 'pr')
      .select('pr.id_producto', 'id_producto')
      .addSelect('pr.nombre', 'nombre')
      .addSelect('pr.tipo', 'tipo')
      .addSelect('SUM(d.cantidad)', 'unidades')
      .addSelect('SUM(d.subtotal)', 'ventas')
      .where('1=1');

    if (q.caja) qb.andWhere('p.id_caja = :caja', { caja: q.caja });

    const expr = this.buildBetween(q.desde, q.hasta);
    if (expr) {
      // usamos created_at del pedido
      const d1 = (expr as any)._low ?? new Date(0);
      const d2 = (expr as any)._high ?? new Date();
      qb.andWhere('p.created_at BETWEEN :ini AND :fin', { ini: d1, fin: d2 });
    }

    qb.groupBy('pr.id_producto')
      .addGroupBy('pr.nombre')
      .addGroupBy('pr.tipo')
      .orderBy('pr.id_producto', 'ASC');

    const rows = await qb.getRawMany<{
      id_producto: number;
      nombre: string;
      tipo: TipoProducto;
      unidades: string;
      ventas: string;
    }>();

    return rows.map(r => ({
      id_producto: Number(r.id_producto),
      nombre: r.nombre,
      tipo: r.tipo,
      unidades: Number(r.unidades ?? 0),
      ventas: Number(r.ventas ?? 0),
    }));
  }

  // --- Resumen de mermas por producto ---
  async mermasResumen(q: RangoFechas) {
    const qb = this.movRepo
      .createQueryBuilder('m')
      .innerJoin('m.inventario', 'i')
      .innerJoin('i.producto', 'p')
      .select('p.id_producto', 'id_producto')
      .addSelect('p.nombre', 'nombre')
      .addSelect('p.tipo', 'tipo')
      .addSelect('SUM(m.cantidad)', 'merma_total')
      .where('m.tipo = :t', { t: TipoMovimiento.MERMA });

    const expr = this.buildBetween(q.desde, q.hasta);
    if (expr) {
      const d1 = (expr as any)._low ?? new Date(0);
      const d2 = (expr as any)._high ?? new Date();
      qb.andWhere('m.created_at BETWEEN :ini AND :fin', { ini: d1, fin: d2 });
    }

    qb.groupBy('p.id_producto').addGroupBy('p.nombre').addGroupBy('p.tipo').orderBy('p.id_producto', 'ASC');

    const rows = await qb.getRawMany<{ id_producto: number; nombre: string; tipo: TipoProducto; merma_total: string }>();

    const detalle = rows.map(r => ({
      id_producto: Number(r.id_producto),
      nombre: r.nombre,
      tipo: r.tipo,
      merma_total: Number(r.merma_total ?? 0),
    }));

    const total_mermas = detalle.reduce((acc, x) => acc + x.merma_total, 0);

    return {
      periodo: { desde: q.desde ?? null, hasta: q.hasta ?? null },
      total_mermas,
      detalle,
    };
  }

  // ====================================================================
  //  RESUMEN GERENCIAL (todo agregado en SQL, sin tope de pedidos)
  // ====================================================================

  /** Convierte el rango YYYY-MM-DD en fechas usables; "hasta" se extiende a fin del día. */
  private rango(desde?: string, hasta?: string): { ini: Date; fin: Date } {
    const ini = this.parseDateMaybe(desde) ?? new Date(0);
    let fin = this.parseDateMaybe(hasta);
    if (fin) {
      if (fin.getHours() === 0 && fin.getMinutes() === 0) fin.setHours(23, 59, 59, 999);
    } else {
      fin = new Date();
    }
    return { ini, fin };
  }

  /**
   * Reporte consolidado del período. Toda la cuenta se hace en la base de datos:
   * no traemos los pedidos al servidor ni dependemos del límite de paginación.
   */
  async resumen(q: ReportRangeDto) {
    const { ini, fin } = this.rango(q.desde, q.hasta);
    const caja = q.caja;

    // 1) Productos vendidos: unidades y Bs por producto (todas las órdenes del rango)
    const qProd = this.detRepo
      .createQueryBuilder('d')
      .innerJoin('d.pedido', 'p')
      .innerJoin('d.producto', 'pr')
      .select('pr.id_producto', 'id_producto')
      .addSelect('pr.nombre', 'nombre')
      .addSelect('pr.tipo', 'tipo')
      .addSelect('SUM(d.cantidad)', 'unidades')
      .addSelect('SUM(d.subtotal)', 'ventas')
      .where('p.created_at BETWEEN :ini AND :fin', { ini, fin });
    if (caja) qProd.andWhere('p.id_caja = :caja', { caja });
    qProd
      .groupBy('pr.id_producto')
      .addGroupBy('pr.nombre')
      .addGroupBy('pr.tipo')
      .orderBy('SUM(d.cantidad)', 'DESC');
    const productosRaw = await qProd.getRawMany();
    const productos = productosRaw.map((r) => ({
      id_producto: Number(r.id_producto),
      nombre: r.nombre,
      tipo: r.tipo,
      unidades: Number(r.unidades ?? 0),
      ventas: Number(r.ventas ?? 0),
    }));

    // 2) Unidades por destino (un pedido MIXTO aporta a MESA y a LLEVAR según cada ítem)
    const qDest = this.detRepo
      .createQueryBuilder('d')
      .innerJoin('d.pedido', 'p')
      .select('d.destino', 'destino')
      .addSelect('SUM(d.cantidad)', 'unidades')
      .where('p.created_at BETWEEN :ini AND :fin', { ini, fin });
    if (caja) qDest.andWhere('p.id_caja = :caja', { caja });
    qDest.groupBy('d.destino');
    const destRaw = await qDest.getRawMany();
    const items_por_destino = { mesa: 0, llevar: 0 };
    for (const r of destRaw) {
      if (r.destino === 'MESA') items_por_destino.mesa = Number(r.unidades ?? 0);
      else if (r.destino === 'LLEVAR') items_por_destino.llevar = Number(r.unidades ?? 0);
    }

    // 3) Pedidos por tipo (MESA / LLEVAR / MIXTO) — conteo de pedidos
    const qTipo = this.pedRepo
      .createQueryBuilder('p')
      .select('p.tipo_pedido', 'tipo')
      .addSelect('COUNT(1)', 'cantidad')
      .where('p.created_at BETWEEN :ini AND :fin', { ini, fin });
    if (caja) qTipo.andWhere('p.id_caja = :caja', { caja });
    qTipo.groupBy('p.tipo_pedido');
    const tipoRaw = await qTipo.getRawMany();
    const pedidos_por_tipo = { MESA: 0, LLEVAR: 0, MIXTO: 0 };
    for (const r of tipoRaw) {
      if (r.tipo === 'MESA') pedidos_por_tipo.MESA = Number(r.cantidad ?? 0);
      else if (r.tipo === 'LLEVAR') pedidos_por_tipo.LLEVAR = Number(r.cantidad ?? 0);
      else if (r.tipo === 'MIXTO') pedidos_por_tipo.MIXTO = Number(r.cantidad ?? 0);
    }

    // 4) Métodos de pago: monto y nº de pedidos (solo PAGADOS)
    const qPago = this.pedRepo
      .createQueryBuilder('p')
      .select('p.metodo_pago', 'metodo')
      .addSelect('SUM(p.total)', 'monto')
      .addSelect('COUNT(1)', 'pedidos')
      .where('p.created_at BETWEEN :ini AND :fin', { ini, fin })
      .andWhere('p.estado_pago::text = :pg', { pg: 'PAGADO' });
    if (caja) qPago.andWhere('p.id_caja = :caja', { caja });
    qPago.groupBy('p.metodo_pago');
    const pagoRaw = await qPago.getRawMany();
    const metodos_pago = {
      efectivo: { monto: 0, pedidos: 0 },
      qr: { monto: 0, pedidos: 0 },
    };
    for (const r of pagoRaw) {
      const m = String(r.metodo ?? '').toUpperCase();
      if (m === 'EFECTIVO') metodos_pago.efectivo = { monto: Number(r.monto ?? 0), pedidos: Number(r.pedidos ?? 0) };
      else if (m === 'QR') metodos_pago.qr = { monto: Number(r.monto ?? 0), pedidos: Number(r.pedidos ?? 0) };
    }

    // 5) Pedidos despachados (estado del pedido = LISTO)
    const qDesp = this.pedRepo
      .createQueryBuilder('p')
      .where('p.created_at BETWEEN :ini AND :fin', { ini, fin })
      .andWhere('p.estado_pedido::text = :lst', { lst: 'LISTO' });
    if (caja) qDesp.andWhere('p.id_caja = :caja', { caja });
    const pedidos_despachados = await qDesp.getCount();

    // 6) Totales derivados
    const venta_total = metodos_pago.efectivo.monto + metodos_pago.qr.monto;
    const pedidos_pagados = metodos_pago.efectivo.pedidos + metodos_pago.qr.pedidos;
    const unidades_total = productos.reduce((acc, x) => acc + x.unidades, 0);
    const pedidos_total = pedidos_por_tipo.MESA + pedidos_por_tipo.LLEVAR + pedidos_por_tipo.MIXTO;

    return {
      periodo: { desde: q.desde ?? null, hasta: q.hasta ?? null },
      totales: {
        venta_total: Number(venta_total.toFixed(2)),
        pedidos_pagados,
        pedidos_despachados,
        pedidos_total,
        unidades_total,
      },
      metodos_pago,
      pedidos_por_tipo,
      items_por_destino,
      productos,
    };
  }

  /**
   * Ventas agrupadas por día (hora Bolivia). Solo pedidos PAGADOS.
   * Devuelve array de { fecha, platos, bebidas, extras, total, pedidos }
   */
  async resumenPorDia(q: ReportRangeDto) {
    const { ini, fin } = this.rango(q.desde, q.hasta);

    const qb = this.detRepo
      .createQueryBuilder('d')
      .innerJoin('d.pedido', 'p')
      .innerJoin('d.producto', 'pr')
      .select("TO_CHAR(p.created_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')", 'fecha')
      .addSelect(
        "SUM(CASE WHEN pr.tipo = 'PLATO' THEN d.subtotal ELSE 0 END)",
        'platos',
      )
      .addSelect(
        "SUM(CASE WHEN pr.tipo = 'BEBIDA' THEN d.subtotal ELSE 0 END)",
        'bebidas',
      )
      .addSelect(
        "SUM(CASE WHEN pr.tipo = 'EXTRA' THEN d.subtotal ELSE 0 END)",
        'extras',
      )
      .addSelect('SUM(d.subtotal)', 'total')
      .addSelect('COUNT(DISTINCT p.id_pedido)', 'pedidos')
      .where('p.created_at BETWEEN :ini AND :fin', { ini, fin })
      .andWhere("p.estado_pago::text = 'PAGADO'")
      .groupBy("TO_CHAR(p.created_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(p.created_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')", 'ASC');

    const rows = await qb.getRawMany();

    return rows.map((r) => ({
      fecha: String(r.fecha).substring(0, 10),
      platos:  Number(r.platos  ?? 0),
      bebidas: Number(r.bebidas ?? 0),
      extras:  Number(r.extras  ?? 0),
      total:   Number(r.total   ?? 0),
      pedidos: Number(r.pedidos ?? 0),
    }));
  }
}
