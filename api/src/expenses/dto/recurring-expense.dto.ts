import { ExpenseCategory } from '@prisma/client';

export class CreateRecurringExpenseDto {
  description: string;
  amount: number;
  category?: string;
  dayOfMonth: number;
  propertyId: string;
}

export class UpdateRecurringExpenseDto {
  description?: string;
  amount?: number;
  category?: string;
  dayOfMonth?: number;
  isActive?: boolean;
}
