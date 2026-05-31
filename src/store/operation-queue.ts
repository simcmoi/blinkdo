let pending: Promise<void> = Promise.resolve()

export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = pending.then(() => fn(), () => fn())
  pending = result.then(() => {}, () => {})
  return result
}
