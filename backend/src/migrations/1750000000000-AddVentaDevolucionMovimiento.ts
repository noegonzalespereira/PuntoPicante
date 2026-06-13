import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega los valores VENTA y DEVOLUCION al enum de tipos de movimiento de inventario.
 *
 * El kardex ahora registra las ventas (y sus anulaciones) como movimientos, en vez
 * de descontar directamente el stock inicial. Postgres guarda el tipo como un ENUM,
 * así que hay que ampliar ese tipo antes de poder insertar los valores nuevos.
 *
 * NOTA: el nombre del tipo enum que crea TypeORM por defecto es
 *   "<tabla>_<columna>_enum"  ->  "inventario_mov_tipo_enum"
 * Si en tu base se llama distinto, ajusta el nombre abajo.
 */
export class AddVentaDevolucionMovimiento1750000000000 implements MigrationInterface {
  name = 'AddVentaDevolucionMovimiento1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "inventario_mov_tipo_enum" ADD VALUE IF NOT EXISTS 'VENTA'`,
    );
    await queryRunner.query(
      `ALTER TYPE "inventario_mov_tipo_enum" ADD VALUE IF NOT EXISTS 'DEVOLUCION'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres no permite eliminar valores de un enum de forma sencilla.
    // Para revertir habría que recrear el tipo; no es necesario en la práctica.
  }
}
