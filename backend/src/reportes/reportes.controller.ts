import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReportRangeDto } from './dto/report-range.dto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/guards';

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  /**
   * GET /reportes/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&caja=ID]
   * Resumen gerencial: productos vendidos, destinos, tipos de pedido y métodos de pago.
   * Roles: GERENTE
   */
  @Get('resumen')
  @Roles('GERENTE')
  resumen(@Query() q: ReportRangeDto) {
    return this.service.resumen(q);
  }

  /**
   * GET /reportes/mermas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
   * Roles: GERENTE
   */
  @Get('mermas')
  @Roles('GERENTE')
  mermasResumen(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.mermasResumen({ desde, hasta });
  }
}
