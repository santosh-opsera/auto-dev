import { ticketKeySchema } from '@autodev/shared-types';

export function validateTicketKey(value: string): string | undefined {
  const result = ticketKeySchema.safeParse(value.trim());
  if (!result.success) {
    return result.error.issues[0]?.message ?? 'Invalid ticket key.';
  }
  return undefined;
}
