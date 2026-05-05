import { ExternalServiceError } from '../../errors/app-error'
import type { ExportProvider, ExportTicketPayload } from './types'

export class PlaceholderExportProvider implements ExportProvider {
  async exportTicket(_payload: ExportTicketPayload): Promise<{ externalId: string }> {
    throw new ExternalServiceError('No export integration is configured for this organization')
  }
}
