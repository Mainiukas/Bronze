/** A seed for a fresh match. (The engine itself never uses randomness: the seed decides everything.) */
export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000)
}
