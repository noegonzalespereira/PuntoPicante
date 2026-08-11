import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { InventarioProducto, ModoInventario } from './inventario-producto.entity';
import { InventarioMovimiento, TipoMovimiento } from './inventario-mov.entity';
import { Producto, TipoProducto } from '../productos/producto.entity';
import { AperturaPlatosDto } from './dto/apertura-platos.dto';
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
    const d = date ? new Date(date) : new Date();

    // Forzar zona horaria de Bolivia (UTC-4) para consistencia,
    // sin importar la configuración del servidor.
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const boliviaOffset = -4 * 60 * 60000;
    const local = new Date(utc + boliviaOffset);

    return local.toISOString().slice(0, 10);
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

  /** Busca la fila de inventario de un producto (PLATO: por fecha · BEBIDA/EXTRA: global). */
  private async filaDeProducto(prod: Producto, id_producto: number, fecha?: string) {
    const f = fecha ?? this.ymd();
    // BEBIDA, EXTRA y PLATO ahora todos usan un registro diario por fecha.
    return this.invRepo.findOne({
      where: { producto: { id_producto }, fecha: f },
    });
  }

  // ====================================================================
  //  DISPONIBILIDAD
  // ====================================================================

  /** Stock disponible de UN producto (lo usa la venta para validar). */
  async disponibleProducto(id_producto: number, fecha?: string): Promise<number> {
    const prod = await this.prodRepo.findOne({ where: { id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    // Para BEBIDA y EXTRA, el stock es conceptualmente infinito para la venta.
    if (prod.tipo === TipoProducto.BEBIDA || prod.tipo === TipoProducto.EXTRA) {
      return 9999;
    }

    // Para PLATO, se mantiene la lógica de apertura.
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

    const f = fecha ?? this.ymd();
    let row = await this.filaDeProducto(prod, id_producto, f);

    if (prod.tipo === TipoProducto.PLATO) {
      if (!row) {
        throw new BadRequestException(`No hay apertura para el plato "${prod.nombre}" en ${f}`);
      }
      const agg = await this.agregadoDeFila(row.id_inventario);
      const disponible = this.calcularDesglose(row.cantidad_inicial, agg).disponible;
      if (disponible < cantidad) {
        throw new BadRequestException(`Stock insuficiente para "${prod.nombre}" (disponible ${disponible})`);
      }
    } else { // BEBIDA o EXTRA
      if (!row) {
        const modo = prod.tipo === TipoProducto.EXTRA ? ModoInventario.EXTRA : ModoInventario.BEBIDA;
        row = await this.invRepo.save(this.invRepo.create({ producto: { id_producto } as any, modo, fecha: f, cantidad_inicial: 0 }));
      }
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

    const f = fecha ?? this.ymd();
    let row = await this.filaDeProducto(prod, id_producto, f);
    if (!row) {
      // Caso raro: se libera sin fila previa. La creamos vacía para no perder el registro.
      const modo = prod.tipo === TipoProducto.PLATO ? ModoInventario.PLATO
                 : prod.tipo === TipoProducto.EXTRA ? ModoInventario.EXTRA
                 : ModoInventario.BEBIDA;
      row = await this.invRepo.save(this.invRepo.create({ producto: { id_producto } as any, modo, fecha: f, cantidad_inicial: 0 }));
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

  /** Merma (PLATO por día o BEBIDA global): valida disponible y registra MERMA. */
  async merma(dto: MermaDto) {
    const prod = await this.prodRepo.findOne({ where: { id_producto: dto.id_producto } });
    if (!prod) throw new NotFoundException('Producto no existe');

    // A petición, las mermas solo se registran para platos.
    if (prod.tipo !== TipoProducto.PLATO) {
      throw new BadRequestException('El registro de mermas solo está permitido para productos de tipo PLATO.');
    }

    const fecha = dto.fecha ?? this.ymd();
    const row = await this.filaDeProducto(prod, dto.id_producto, fecha);
    if (!row) {
      throw new BadRequestException('No hay apertura de stock para este plato en la fecha indicada. No se puede registrar la merma.');
    }

    // La validación de stock solo aplica a platos
    const agg = await this.agregadoDeFila(row.id_inventario);
    const disponible = this.calcularDesglose(row.cantidad_inicial, agg).disponible;
    if (disponible < dto.cantidad) throw new BadRequestException(`Stock insuficiente para merma (disponible ${disponible})`);

    await this.movRepo.save(
      this.movRepo.create({
        inventario: row,
        tipo: TipoMovimiento.MERMA,
        cantidad: dto.cantidad,
        motivo: dto.motivo ?? 'MERMA',
      }),
    );

    const finalAgg = await this.agregadoDeFila(row.id_inventario);
    const desglose = this.calcularDesglose(row.cantidad_inicial, finalAgg);

    return {
      ok: true,
      id_producto: dto.id_producto,
      fecha: row.fecha,
      stock: desglose.disponible,
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
      where: { fecha, modo: ModoInventario.BEBIDA },
      relations: { producto: true },
      order: { id_inventario: 'ASC' },
    });

    const extras = await this.invRepo.find({
      where: { fecha, modo: ModoInventario.EXTRA },
      relations: { producto: true },
      order: { id_inventario: 'ASC' },
    });

    const ids = [...platos, ...bebidas, ...extras].map((i) => i.id_inventario);
    const agg = await this.agregadoDeFilas(ids);

    const mapFila = (i: InventarioProducto) => {
      const d = this.calcularDesglose(i.cantidad_inicial, agg.get(i.id_inventario) ?? { venta: 0, devolucion: 0, merma: 0 });
      return {
        id_producto: i.id_producto,
        nombre: i.producto.nombre,
        stock_inicial: d.stock_inicial,
        vendido: d.vendido,
        merma: d.merma,
        stock: d.disponible,
      };
    };

    return {
      fecha,
      platos: platos.map(mapFila),
      bebidas: bebidas.map(mapFila),
      extras: extras.map(mapFila),
    };
  }

  /** Alias histórico: mismo desglose que `disponible`. */
  async getDesgloseStockDelDia(fecha: string) {
    return this.disponible({ fecha } as QueryDisponibleDto);
  }

  /** Historial de mermas (para la pestaña Mermas del frontend). */
  async listarMermas(): Promise<any[]> {
    const movimientos = await this.movRepo.find({
      where: {
        tipo: TipoMovimiento.MERMA,
        inventario: { modo: ModoInventario.PLATO }, // Solo mermas de platos
      },
      relations: { inventario: { producto: true } },
      order: { created_at: 'DESC' },
    });
    return movimientos.map((mov) => ({
      id_mov: mov.id_mov,
      producto_nombre: mov.inventario.producto.nombre, // el frontend lee este nombre
      cantidad: mov.cantidad,
      motivo: mov.motivo,
      fecha: mov.inventario.fecha, // Siempre tendrá fecha porque es de un plato
    }));
  }
}
