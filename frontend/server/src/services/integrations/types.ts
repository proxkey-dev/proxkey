export type ExportTicketPayload = {
  ticketTitle: string
  ticketDescription: string
  organizationId: string
}

export interface ExportProvider {
  exportTicket(payload: ExportTicketPayload): Promise<{ externalId: string }>
}
