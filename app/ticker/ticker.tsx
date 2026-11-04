'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

type Headline = { id: string; text: string; source: string };
type TickerSettings = {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  scrollSpeed: number;
  feedUrl: string;
  feedLabel: string;
};

const defaultSettings: TickerSettings = {
  accentColor: '#ffb000',
  backgroundColor: '#0a0e16',
  textColor: '#ffffff',
  fontFamily: 'Geist',
  fontSize: 25,
  scrollSpeed: 90,
  feedUrl: '',
  feedLabel: 'SPORTS',
};

export function Ticker() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [settings, setSettings] = useState<TickerSettings>(defaultSettings);
  const [scrollDuration, setScrollDuration] = useState(140);
  const [previewOverride, setPreviewOverride] = useState<Partial<TickerSettings> | null>(null);
  const firstLoad = useRef(true);
  const groupRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      // Preview mode (control panel) must never consume "play next" headlines meant for OBS.
      const isPreview = new URLSearchParams(window.location.search).has('preview');
      const consume = firstLoad.current && !isPreview;
      const [response, settingsResponse] = await Promise.all([
        fetch(`/api/headlines${consume ? '?consumeNext=1' : ''}`, { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
      ]);
      if (!response.ok || !settingsResponse.ok) throw new Error();
      const data = (await response.json()) as { headlines: Headline[] };
      setSettings(await settingsResponse.json() as TickerSettings);
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

  // Preview mode: the control panel streams unsaved settings in and asks for refreshes.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('preview') || window.parent === window) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; settings?: Partial<TickerSettings> } | null;
      if (data?.type === 'ticker-preview:settings' && data.settings) setPreviewOverride(data.settings);
      if (data?.type === 'ticker-preview:refresh') void load();
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'ticker-preview:ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [load]);

  const view: TickerSettings = previewOverride ? { ...settings, ...previewOverride } : settings;

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => setScrollDuration(Math.max(group.scrollWidth / view.scrollSpeed, 8));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [headlines, view.scrollSpeed, view.fontSize, view.fontFamily]);

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
    <main
      className="ticker-shell"
      aria-label="Live sports headlines"
      style={{
        '--ticker-accent': view.accentColor,
        '--ticker-background': view.backgroundColor,
        '--ticker-text': view.textColor,
        '--ticker-font': view.fontFamily === 'Geist' ? 'var(--font-geist-sans)' : view.fontFamily,
        '--ticker-size': `${view.fontSize}px`,
        '--ticker-duration': `${scrollDuration}s`,
      } as CSSProperties}
    >
      <div className="ticker-badge"><span className="live-dot" /> LIVE WIRE</div>
      <div className="ticker-window">
        <div className="ticker-track">
          <div ref={groupRef} className="ticker-group">{strip}</div>
          <div className="ticker-group" aria-hidden="true">{strip}</div>
        </div>
      </div>
    </main>
  );
}
