import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { reportQuerySchema, type ReportQuery } from '@dispatcher/shared';
import { Auth, RequirePermission } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthContext } from '../../common/auth-context';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermission('finances:read')
  summary(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(reportQuerySchema)) query: ReportQuery,
  ) {
    return this.reports.summary(auth, query);
  }

  @Get('trips.csv')
  @RequirePermission('finances:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="ai-dispatcher-trips.csv"',
  )
  tripsCsv(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(reportQuerySchema)) query: ReportQuery,
  ) {
    return this.reports.tripsCsv(auth, query);
  }

  @Get('ai')
  @RequirePermission('finances:read')
  ai(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(reportQuerySchema)) query: ReportQuery,
  ) {
    return this.reports.ai(auth, query);
  }
}
