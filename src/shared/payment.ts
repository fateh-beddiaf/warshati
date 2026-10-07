import type { PaymentType } from './types'

/**
 * The payment type follows the remaining amount, everywhere a payment is written (creation, edit, delivery, debt
 * payment): nothing left to pay = 'cash', a remaining balance = 'credit' (a debt). It is never chosen by hand.
 */
export function paymentTypeFor(amountRemaining: number): PaymentType {
  return amountRemaining > 0 ? 'credit' : 'cash'
}
