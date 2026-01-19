import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db.module';
import { AuthModule } from './auth/auth.module';
import { ProductosModule } from './productos/productos.module';
import { CajaModule } from './caja/caja.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { GastosModule } from './gastos/gastos.module';
import { UsersModule } from './usuarios/usuarios.module';
import { InventarioModule } from './inventario/inventario.module';
import { ReportesModule } from './reportes/reportes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthModule,
    UsersModule,
    CajaModule,
    ProductosModule,
    PedidosModule,
    GastosModule,
    ReportesModule,
    InventarioModule,
  ],
})
export class AppModule {}

