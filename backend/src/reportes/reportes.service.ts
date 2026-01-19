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
}
