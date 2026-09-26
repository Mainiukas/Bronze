import type { Quote, ShipQuote } from '../../game/engine'

/** "£11 (buys 1 iron)" */
export function describeQuote(q: Quote): string {
  const bought = [q.coalBought && `${q.coalBought} coal`, q.ironBought && `${q.ironBought} iron`].filter(Boolean)
  const used = [q.coalUsed && `${q.coalUsed} coal`, q.ironUsed && `${q.ironUsed} iron`].filter(Boolean)
  const notes = [bought.length ? `buys ${bought.join(' + ')}` : '', used.length ? `uses your ${used.join(' + ')}` : ''].filter(Boolean).join(', ')
  return `£${q.total}${notes ? ` (${notes})` : ''}`
}

/** "+£16 · +6★" */
export const payoutLabel = (q: ShipQuote) => `${q.net >= 0 ? '+' : '−'}£${Math.abs(q.net)} · +${q.prestige}★`
