/** One bounded request per source: slow polls cannot pile up or overwrite newer results. */
export function createJsonPoller(timeoutMs = 30_000) {
  const pending = new Map<string, Promise<unknown>>();
  return function poll<T>(url: string): Promise<T> {
    const existing = pending.get(url);
    if (existing) return existing as Promise<T>;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const request = (async () => {
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return await response.json();
      } finally {
        clearTimeout(timer);
        pending.delete(url);
      }
    })();
    pending.set(url, request);
    return request as Promise<T>;
  };
}

/** A skipped wait must cancel its old timer before a later scene installs a new hook. */
export function createSceneWaiter() {
  const pending = new Set<() => void>();
  return {
    wait: (ms: number, hook?: { current: (() => void) | null }) => {
      return new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          pending.delete(done);
          if (hook?.current === done) hook.current = null;
          resolve();
        };
        const timer = setTimeout(done, ms);
        pending.add(done);
        if (hook) hook.current = done;
      });
    },
    cancel() {
      for (const done of pending) done();
    },
  };
}
