import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { InventarioProducto, ModoInventario } from './inventario-producto.entity';
import { InventarioMovimiento, TipoMovimiento } from './inventario-mov.entity';
import { Producto, TipoProducto } from '../productos/producto.entity';
import { AperturaPlatosDto } from './dto/apertura-platos.dto';
import { IngresoBebidaDto } from './dto/ingreso-bebida.dto';
import { MermaDto, MermaSobre } from './dto/merma.dto';
import { QueryDisponibleDto } from './dto/query-disponible.dto';

/** Totales del kardex de UNA fila de inventario. */
type AgregadoMov = { venta: number; devolucion: number; merma: number };

@Injectable()
export class InventarioService {
  constructor(
    @InjectRepository(InventarioProducto) private readonly invRepo: Repository<InventarioProducto>,
    @InjectRepository(InventarioMovimiento) private readonly movRepo: Repository<InventarioMovimiento>,
    @InjectRepository(Producto) private readonly prodRepo: Repository<Producto>,
  ) {}

  private ymd(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ====================================================================
  //  HELPERS DEL KARDEX
  //  El stock disponible NO se guarda: se calcula sumando los movimientos.
  //  disponible = cantidad_inicial - ventas + devoluciones - mermas
  // ====================================================================

  /** Suma los movimientos (venta/devolución/merma) de UNA fila de inventario. */
  private async agregadoDeFila(id_inventario: number): Promise<AgregadoMov> {
    const raw = await this.movRepo
      .createQueryBuilder('m')
      .innerJoin('m.inventario', 'inv')
      .select('COALESCE(SUM(CASE WHEN m.tipo::text = :v THEN m.cantidad ELSE 0 END), 0)', 'venta')
      .addSelect('COALESCE(SUM(CASE WHEN m.tipo::text = :d THEN m.cantidad ELSE 0 END), 0)', 'devolucion')
      .addSelect('COALESCE(SUM(CASE WHEN m.tipo::text = :me THEN m.cantidad ELSE 0 END), 0)', 'merma')
      .where('inv.id_inventario = :id', { id: id_inventario })
      .setParameters({
        v: TipoMovimiento.VENTA,
        d: TipoMovimiento.DEVOLUCION,
        me: TipoMovimiento.MERMA,
      })
      .getRawOne<{ venta: string; devolucion: string; merma: string }>();

    return {
      venta: Number(raw?.venta ?? 0),
      devolucion: Number(raw?.devolucion ?? 0),
      merma: Number(raw?.merma ?? 0),
    };
  }

  /** Igual que arriba pero para MUCHAS filas a la vez (una sola query, agrupada). */
  private async agregadoDeFilas(ids: number[]): Promise<Map<number, AgregadoMov>> {
    const map = new Map<number, AgregadoMov>();
    if (!ids.length) return map;

    const rows = await this.movRepo
      .createQueryBuilder('m')
      .innerJoin('m.inventario', 'inv')
      .select('inv.id_inventario', 'id_inventario')
      .addSelect('COALESCE(SUM(CASE WHEN m.tipo::text = :v THEN m.cantidad ELSE 0 END), 0)', 'venta')
      .addSelect('COALESCE(SUM(CASE WHEN m.tipo::text = :d THEN m.cantidad ELSE 0 END), 0)', 'devolucion')
      .addSelect('COALESCE(SUM(CASE WHEN m.tipo::text = :me THEN m.cantidad ELSE 0 END), 0)', 'merma')
      .where('inv.id_inventario IN (:...ids)', { ids })
      .setParameters({
        v: TipoMovimiento.VENTA,
        d: TipoMovimiento.DEVOLUCION,
        me: TipoMovimiento.MERMA,
      })
      .groupBy('inv.id_inventario')
      .getRawMany<{ id_inventario: number; venta: string; devolucion: string; merma: string }>();

    for (const r of rows) {
      map.set(Number(r.id_inventario), {
        venta: Number(r.venta ?? 0),
        devolucion: Number(r.devolucion ?? 0),
        merma: Number(r.merma ?? 0),
      });
    }
    return map;
  }

  /** A partir del inicial + el agregado del kardex, calcula vendido/merma/disponible. */
  private calcularDesglose(cantidad_inicial: number, agg: AgregadoMov) {
    const vendido = agg.venta - agg.devolucion; // venta neta
    const merma = agg.merma;
    const disponible = cantidad_inicial - vendido - merma;
    return { stock_inicial: cantidad_inicial, vendido, merma, disponible };
  }

  /** Busca la fila de inventario de un producto (PLATO: por fecha · BEBIDA: global). */
  private async filaDeProducto(prod: Producto, id_producto: number, fecha?: string) {
    if (prod.tipo === TipoProducto.PLATO) {
      const f = fecha ?? this.ymd();
      return this.invRepo.findOne({ where: { producto: { id_producto }, fecha: f } });
    }
    return this.invRepo.findOne({ where: { producto: { id_producto }, fecha: IsNull() } });
  }

  // ====================================================================
  //  DISPONIBILIDAD
  // ====================================================================

  /** Stock disponible de UN producto (lo usa la venta para validar). */
  async disponibleProducto(id_producto: number, fecha?: string): Promise<number> {
    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    const row = await this.filaDeProducto(prod, id_producto, fecha);
    if (!row) return 0;

    const agg = await this.agregadoDeFila(row.id_inventario);
    return this.calcularDesglose(row.cantidad_inicial, agg).disponible;
  }

  // ====================================================================
  //  MOVIMIENTOS DE VENTA (los llama el módulo de pedidos)
  //  Ya NO mutan cantidad_inicial: solo registran un movimiento en el kardex.
  // ====================================================================

  /** Reserva (venta): valida disponibilidad y registra un movimiento VENTA. */
  async reservar(id_producto: number, cantidad: number, fecha?: string): Promise<void> {
    if (cantidad <= 0) throw new BadRequestException('Cantidad inválida');

    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    const row = await this.filaDeProducto(prod, id_producto, fecha);
    if (!row) {
      throw new BadRequestException(
        prod.tipo === TipoProducto.PLATO
          ? `No hay apertura para el plato ${id_producto} en ${fecha ?? this.ymd()}`
          : `No hay stock cargado para la bebida ${id_producto}`,
      );
    }

    const agg = await this.agregadoDeFila(row.id_inventario);
    const disponible = this.calcularDesglose(row.cantidad_inicial, agg).disponible;
    if (disponible < cantidad) {
      throw new BadRequestException(`Stock insuficiente (disponible ${disponible})`);
    }

    await this.movRepo.save(
      this.movRepo.create({
        inventario: row,
        tipo: TipoMovimiento.VENTA,
        cantidad,
        motivo: 'VENTA',
      }),
    );
  }

  /** Libera (anulación / reducción): registra un movimiento DEVOLUCION. */
  async liberar(id_producto: number, cantidad: number, fecha?: string): Promise<void> {
    if (cantidad <= 0) throw new BadRequestException('Cantidad inválida');

    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    let row = await this.filaDeProducto(prod, id_producto, fecha);
    if (!row) {
      // Caso raro: se libera sin fila previa. La creamos vacía para no perder el registro.
      row = await this.invRepo.save(
        this.invRepo.create({
          producto: { id_producto } as any,
          modo: prod.tipo === TipoProducto.PLATO ? ModoInventario.PLATO : ModoInventario.BEBIDA,
          fecha: prod.tipo === TipoProducto.PLATO ? (fecha ?? this.ymd()) : null,
          cantidad_inicial: 0,
        }),
      );
    }

    await this.movRepo.save(
      this.movRepo.create({
        inventario: row,
        tipo: TipoMovimiento.DEVOLUCION,
        cantidad,
        motivo: 'DEVOLUCION',
      }),
    );
  }

  // ====================================================================
  //  APERTURA / INGRESO (definen el stock inicial)
  // ====================================================================

  /** Apertura diaria de PLATOS: fija el stock inicial del día (no registra ventas). */
  async aperturaPlatos(dto: AperturaPlatosDto) {
    const ids = dto.items.map((i) => i.id_producto);
    const productos = await this.prodRepo.find({ where: { id_producto: In(ids) } });
    const porId = new Map(productos.map((p) => [p.id_producto, p]));

    for (const it of dto.items) {
      const p = porId.get(it.id_producto);
      if (!p) throw new BadRequestException(`Producto ${it.id_producto} no existe`);
      if (p.tipo !== TipoProducto.PLATO)
        throw new BadRequestException(`Producto ${it.id_producto} no es PLATO`);
    }

    const results: { id_producto: number; fecha: string; cantidad_inicial: number }[] = [];

    for (const it of dto.items) {
      let inv = await this.invRepo.findOne({
        where: { producto: { id_producto: it.id_producto }, fecha: dto.fecha },
      });

      if (inv) {
        inv.cantidad_inicial = it.cantidad_inicial;
        await this.invRepo.save(inv);
      } else {
        await this.invRepo.save(
          this.invRepo.create({
            producto: { id_producto: it.id_producto } as any,
            modo: ModoInventario.PLATO,
            fecha: dto.fecha,
            cantidad_inicial: it.cantidad_inicial,
          }),
        );
      }

      results.push({
        id_producto: it.id_producto,
        fecha: dto.fecha,
        cantidad_inicial: it.cantidad_inicial,
      });
    }

    return { ok: true, items: results };
  }

  /** Ingreso de stock para BEBIDA (global). Suma al inicial y registra un INGRESO. */
  async ingresoBebida(dto: IngresoBebidaDto) {
    const prod = await this.prodRepo.findOne({ where: { id_producto: dto.id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');
    if (prod.tipo !== TipoProducto.BEBIDA) throw new BadRequestException('Solo aplica a BEBIDA');

    let row = await this.invRepo.findOne({
      where: { producto: { id_producto: dto.id_producto }, fecha: IsNull() },
    });
    if (!row) {
      row = this.invRepo.create({
        producto: { id_producto: dto.id_producto } as any,
        modo: ModoInventario.BEBIDA,
        fecha: null,
        cantidad_inicial: 0,
      });
    }

    row.cantidad_inicial += dto.cantidad;
    row = await this.invRepo.save(row);

    await this.movRepo.save(
      this.movRepo.create({
        inventario: row,
        tipo: TipoMovimiento.INGRESO,
        cantidad: dto.cantidad,
        motivo: dto.motivo ?? 'INGRESO',
      }),
    );

    const agg = await this.agregadoDeFila(row.id_inventario);
    return {
      ok: true,
      id_producto: dto.id_producto,
      stock: this.calcularDesglose(row.cantidad_inicial, agg).disponible,
    };
  }

  /** Merma (PLATO por día o BEBIDA global): valida disponible y registra MERMA. */
  async merma(dto: MermaDto) {
    const prod = await this.prodRepo.findOne({ where: { id_producto: dto.id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    const esPlato = dto.sobre === MermaSobre.PLATO;
    if (esPlato && prod.tipo !== TipoProducto.PLATO)
      throw new BadRequestException('El producto no es PLATO');
    if (!esPlato && prod.tipo !== TipoProducto.BEBIDA)
      throw new BadRequestException('El producto no es BEBIDA');

    const fecha = esPlato ? (dto.fecha ?? this.ymd()) : undefined;
    const row = await this.filaDeProducto(prod, dto.id_producto, fecha);
    if (!row) throw new BadRequestException('No hay stock para registrar la merma');

    const agg = await this.agregadoDeFila(row.id_inventario);
    const disponible = this.calcularDesglose(row.cantidad_inicial, agg).disponible;
    if (disponible < dto.cantidad) throw new BadRequestException(`Stock insuficiente (disponible ${disponible})`);

    await this.movRepo.save(
      this.movRepo.create({
        inventario: row,
        tipo: TipoMovimiento.MERMA,
        cantidad: dto.cantidad,
        motivo: dto.motivo ?? 'MERMA',
      }),
    );

    return {
      ok: true,
      id_producto: dto.id_producto,
      fecha: row.fecha ?? 'GLOBAL',
      stock: disponible - dto.cantidad,
    };
  }

  // ====================================================================
  //  CONSULTAS / DESGLOSE
  // ====================================================================

  /** Desglose por fecha: platos del día + bebidas globales, con inicial/vendido/merma/disponible. */
  async disponible(q: QueryDisponibleDto) {
    const fecha = q.fecha ?? this.ymd();

    const platos = await this.invRepo.find({
      where: { fecha, modo: ModoInventario.PLATO },
      relations: { producto: true },
      order: { id_inventario: 'ASC' },
    });

    const bebidas = await this.invRepo.find({
      where: { fecha: IsNull(), modo: ModoInventario.BEBIDA },
      relations: { producto: true },
      order: { id_inventario: 'ASC' },
    });

    const ids = [...platos, ...bebidas].map((i) => i.id_inventario);
    const agg = await this.agregadoDeFilas(ids);

    const mapFila = (i: InventarioProducto) => {
      const d = this.calcularDesglose(i.cantidad_inicial, agg.get(i.id_inventario) ?? { venta: 0, devolucion: 0, merma: 0 });
      return {
        id_producto: i.id_producto,
        nombre: i.producto.nombre,
        stock_inicial: d.stock_inicial,
        vendido: d.vendido,
        merma: d.merma,
        // "stock" = disponible. Se mantiene el nombre para no romper a quien ya lo consume.
        stock: d.disponible,
      };
    };

    return {
      fecha,
      platos: platos.map(mapFila),
      bebidas: bebidas.map(mapFila),
    };
  }

  /** Alias histórico: mismo desglose que `disponible`. */
  async getDesgloseStockDelDia(fecha: string) {
    return this.disponible({ fecha } as QueryDisponibleDto);
  }

  /** Historial de mermas (para la pestaña Mermas del frontend). */
  async listarMermas(): Promise<any[]> {
    const movimientos = await this.movRepo.find({
      where: { tipo: TipoMovimiento.MERMA },
      relations: { inventario: { producto: true } },
      order: { created_at: 'DESC' },
    });
    return movimientos.map((mov) => ({
      id_mov: mov.id_mov,
      producto: mov.inventario.producto.nombre,
      producto_nombre: mov.inventario.producto.nombre, // el frontend lee este nombre
      tipo: mov.inventario.modo,
      cantidad: mov.cantidad,
      motivo: mov.motivo,
      fecha: mov.inventario.fecha ?? 'GLOBAL',
    }));
  }
}
