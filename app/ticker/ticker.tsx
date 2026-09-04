'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Headline = { id: string; text: string; source: 'ESPN' | 'LIVE' };

export function Ticker() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/headlines${firstLoad.current ? '?consumeNext=1' : ''}`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { headlines: Headline[] };
      if (data.headlines.length) setHeadlines(data.headlines);
      setStatus('ready');
      firstLoad.current = false;
    } catch {
      setStatus((current) => (current === 'loading' ? 'error' : current));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (status === 'loading') return null;
  if (status === 'error' || headlines.length === 0) {
    return <div className="ticker-shell"><div className="ticker-badge">LIVE</div><div className="ticker-empty">HEADLINES TEMPORARILY UNAVAILABLE</div></div>;
  }

  const strip = headlines.map((item) => (
    <span className="ticker-item" key={item.id}>
      <strong className={item.source === 'LIVE' ? 'source-live' : ''}>{item.source}</strong>
      <span>{item.text}</span>
      <i aria-hidden="true" />
    </span>
  ));

  return (
    <main className="ticker-shell" aria-label="Live sports headlines">
      <div className="ticker-badge"><span className="live-dot" /> LIVE WIRE</div>
      <div className="ticker-window">
        <div className="ticker-track">
          <div className="ticker-group">{strip}</div>
          <div className="ticker-group" aria-hidden="true">{strip}</div>
        </div>
      </div>
    </main>
  );
}
