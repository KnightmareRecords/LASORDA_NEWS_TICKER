'use client';

// The "Break #" tab: a trapezoid that hangs under the ticker, "BREAK" over "ONE". Its own OBS
// browser source, so the ticker's size never changes. The tab fills whatever size the OBS source is
// (designed for 300×100) and uses the ticker's colors. Blank (0) shows nothing.
// Live-stream rule: a failed request never shows anything new — the tab keeps what it had.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { breakWord } from '@/lib/break-number';
import { createJsonPoller } from '@/lib/ticker-runtime';

const BREAK_POLL_MS = 5_000;
const SETTINGS_POLL_MS = 15_000;

type Colors = { accentColor: string; backgroundColor: string; textColor: string };

export function BreakTab() {
  const [number, setNumber] = useState<number | null>(null);
  // Keep the last word while fading out, so the tab doesn't go blank before it disappears.
  const [shown, setShown] = useState('');
  const [colors, setColors] = useState<Colors>({ accentColor: '#ffb000', backgroundColor: '#0a0e16', textColor: '#ffffff' });
  const poll = useRef(createJsonPoller());

  useEffect(() => {
    // ?n=3 shows a fixed number (control-panel preview / testing) instead of the saved one.
    const fixed = new URLSearchParams(window.location.search).get('n');
    const apply = (next: number) => {
      setNumber(next);
      const nextWord = breakWord(next);
      if (nextWord) setShown(nextWord);
    };
    const loadBreak = async () => {
      if (fixed !== null) {
        apply(Number(fixed));
        return;
      }
      try {
        const data = await poll.current<{ number?: number | null }>('/api/break');
        if (typeof data.number === 'number') apply(data.number);
      } catch { /* keep what is showing */ }
    };
    const loadSettings = async () => {
      try {
        const data = await poll.current<Partial<Colors>>('/api/settings');
        setColors((old) => ({
          accentColor: data.accentColor || old.accentColor,
          backgroundColor: data.backgroundColor || old.backgroundColor,
          textColor: data.textColor || old.textColor,
        }));
      } catch { /* keep the old colors */ }
    };
    void loadBreak();
    void loadSettings();
    const breakTimer = setInterval(loadBreak, BREAK_POLL_MS);
    const settingsTimer = setInterval(loadSettings, SETTINGS_POLL_MS);
    return () => { clearInterval(breakTimer); clearInterval(settingsTimer); };
  }, []);

  const word = breakWord(number ?? 0);

  const style = { '--tab-accent': colors.accentColor, '--tab-bg': colors.backgroundColor, '--tab-text': colors.textColor } as CSSProperties;
  return (
    <main className="break-stage" style={style} aria-live="polite">
      <div className={`break-tab${word ? ' is-on' : ''}`} aria-hidden={!word}>
        <div className="break-tab-inner">
          <span className="break-tab-label">Break</span>
          <span className="break-tab-number">{shown}</span>
        </div>
      </div>
    </main>
  );
}
