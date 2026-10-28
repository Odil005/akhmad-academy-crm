/** Share only running reads. Settled values are never cached. */
export function createInFlightReads<T>() {
  const pending = new Map<string, Promise<T>>();
  return (key: string, read: () => Promise<T>): Promise<T> => {
    const current = pending.get(key);
    if (current) return current;
    const request = Promise.resolve().then(read).finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
    return request;
  };
}