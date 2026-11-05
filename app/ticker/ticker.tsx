'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { HOUSE_PANEL_KEY, HOUSE_PANEL_LOGO, panelColors, TEAMS_BY_KEY } from '@/lib/teams';

type Headline = { id: string; text: string; source: string; team?: string | null; tag?: string | null };

// Brand block on the left edge (like the SportsCenter bug): logo on a light panel, accent trim.
function Brand() {
  return (
    <div className="ticker-badge">
      <div className="ticker-brand">
        {/* Plain <img>: a small static logo in an OBS overlay, no image optimizer needed. */}
        {/* oxlint-disable-next-line next/no-img-element */}
        <img src="/brand/lasordas-card-house.png" alt="Lasorda's Card House" />
      </div>
    </div>
  );
}
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
      // Always replace the list — keeping the old one when it came back empty left deleted
      // custom headlines on screen.
      setHeadlines(data.headlines);
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

  const shellStyle = {
    '--ticker-accent': view.accentColor,
    '--ticker-background': view.backgroundColor,
    '--ticker-text': view.textColor,
    '--ticker-font': view.fontFamily === 'Geist' ? 'var(--font-geist-sans)' : view.fontFamily,
    '--ticker-size': `${view.fontSize}px`,
    '--ticker-duration': `${scrollDuration}s`,
  } as CSSProperties;

  // Same structure and colors as the normal ticker, so the badge's slanted edge sits over the strip.
  if (status === 'error' || headlines.length === 0) {
    return (
      <main className="ticker-shell" aria-label="Live sports headlines" style={shellStyle}>
        <Brand />
        <div className="ticker-window"><div className="ticker-empty">HEADLINES TEMPORARILY UNAVAILABLE</div></div>
      </main>
    );
  }

  // A rotation custom headline can appear several times in one strip, so ids aren't unique keys.
  const strip = headlines.map((item, index) => {
    const team = item.team ? TEAMS_BY_KEY.get(item.team) : undefined;
    const colors = team ? panelColors(team) : null;
    return (
      <span className="ticker-item" key={`${index}-${item.id}`}>
        {item.tag && <em className="ticker-tag">{item.tag}</em>}
        {item.team === HOUSE_PANEL_KEY ? (
          <b className="ticker-house">
            {/* oxlint-disable-next-line next/no-img-element */}
            <img src={HOUSE_PANEL_LOGO} alt="Lasorda's Card House" onError={(event) => event.currentTarget.remove()} />
          </b>
        ) : team ? (
          <b className="ticker-team" style={{ '--team-bg': colors?.background, '--team-fg': colors?.text } as CSSProperties}>
            {/* Team logos are files Jay adds to public/teams/<team key>.png; hidden if the file isn't there. */}
            {/* oxlint-disable-next-line next/no-img-element */}
            <img className="ticker-team-logo" src={`/teams/${team.key}.png`} alt="" onError={(event) => event.currentTarget.remove()} />
            {team.name}
          </b>
        ) : (
          <strong className={item.source === 'LIVE' ? 'source-live' : ''}>{item.source}</strong>
        )}
        <span>{item.text}</span>
        <i aria-hidden="true" />
      </span>
    );
  });

  return (
    <main className="ticker-shell" aria-label="Live sports headlines" style={shellStyle}>
      <Brand />
      <div className="ticker-window">
        <div className="ticker-track">
          <div ref={groupRef} className="ticker-group">{strip}</div>
          <div className="ticker-group" aria-hidden="true">{strip}</div>
        </div>
      </div>
    </main>
  );
}
