import { parseMonthlyReport, type MonthlyReport } from '../../domain/model/monthly-report';
import type { Reports } from '../../domain/ports/in/reports';
import type { ApiGateway } from '../../domain/ports/out/api-gateway';
import { unexpectedAnswer } from './unexpected-answer';

/** Los reportes del negocio (ADR 0035 del backend) sobre la API. */
export class ReportsUseCase implements Reports {
  constructor(private readonly api: ApiGateway) {}

  async monthly(month: string): Promise<MonthlyReport> {
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/reports/monthly',
      query: { month },
    });
    const report = parseMonthlyReport(response.body);
    if (report === null) throw unexpectedAnswer(response.status);
    return report;
  }
}
