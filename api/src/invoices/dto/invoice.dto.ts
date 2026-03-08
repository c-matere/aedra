export class CreateInvoiceDto {
  amount: number;
  description: string;
  dueDate: string;
  status?: string;
  type?: string;
  leaseId: string;
}

export class UpdateInvoiceDto {
  amount?: number;
  description?: string;
  dueDate?: string;
  status?: string;
  type?: string;
  leaseId?: string;
}
