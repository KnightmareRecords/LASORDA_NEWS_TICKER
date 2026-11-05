'use client';

import { Component, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { HOUSE_PANEL_KEY, HOUSE_PANEL_LOGO, panelColors, teamLabel, TEAMS_BY_KEY } from '@/lib/teams';
import type { ScoreItem, ScoreSide } from '@/lib/scores';
import type { Promo } from '@/lib/promos';
import { createJsonPoller, createSceneWaiter } from '@/lib/ticker-runtime';

// Live-stream rule for this file: nothing that breaks (feed, scores, a promo file, a render bug)
// may ever show an error on stream. Each source keeps its last good copy, broken promos are
// skipped, and a render error falls back to the plain bar.

type Headline = { id: string; text: string; source: string; team?: string | null; tag?: string | null };
type Segment = 'news' | 'scores';
type Scene = { kind: Segment; run: number; offset?: number } | { kind: 'promo'; promo: Promo; run: number };
/** The scene fading out during a crossfade, with its scroll speed frozen so it doesn't jump. */
type Leaving = { scene: Scene; duration: number };

const isMediaPromo = (scene: Scene) => scene.kind === 'promo' && scene.promo.kind !== 'text' && Boolean(scene.promo.url);
const sceneKey = (scene: Scene) => `${scene.kind}-${scene.run}`;

const FADE_MS = 1400;
const POLL_MS = 15_000;
const SCORES_POLL_MS = 30_000;
/** How often the ticker checks for the control panel's "Skip ahead" button. */
// 5 s keeps Cloudflare's free 100k requests/day comfortable with OBS + preview + phone view open.
const ADVANCE_POLL_MS = 5_000;
/** A promo file that won't load is skipped, then retried after this long. */
const PROMO_RETRY_MS = 5 * 60_000;
const PROMO_LOAD_TIMEOUT_MS = 20_000;

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
  segmentSeconds: number;
  promoSeconds: number;
  scoresEnabled: boolean;
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
  segmentSeconds: 180,
  promoSeconds: 10,
  scoresEnabled: true,
};

/** Renders nothing instead of crashing the whole overlay; `onError` lets the cycle move on. */
class Quiet extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function hideOnError(event: { currentTarget: HTMLElement }) {
  event.currentTarget.style.display = 'none';
}

function NewsItems({ headlines }: { headlines: Headline[] }) {
  // A rotation custom headline can appear several times in one strip, so ids aren't unique keys.
  return headlines.map((item, index) => {
    const team = item.team ? TEAMS_BY_KEY.get(item.team) : undefined;
    const colors = team ? panelColors(team) : null;
    return (
      <span className="ticker-item" key={`${index}-${item.id}`}>
        {item.tag && <em className="ticker-tag">{item.tag}</em>}
        {item.team === HOUSE_PANEL_KEY ? (
          <b className="ticker-house">
            {/* oxlint-disable-next-line next/no-img-element */}
            <img src={HOUSE_PANEL_LOGO} alt="Lasorda's Card House" onError={hideOnError} />
          </b>
        ) : team ? (
          <b className="ticker-team" style={{ '--team-bg': colors?.background, '--team-fg': colors?.text } as CSSProperties}>
            {/* Team logos are public/teams/<team key>.png; hidden if a file is missing. */}
            {/* oxlint-disable-next-line next/no-img-element */}
            <img className="ticker-team-logo" src={`/teams/${team.key}.png`} alt="" onError={hideOnError} />
            {teamLabel(team)}
          </b>
        ) : (
          <strong className={item.source === 'LIVE' ? 'source-live' : ''}>{item.source}</strong>
        )}
        <span>{item.text}</span>
        <i aria-hidden="true" />
      </span>
    );
  });
}

function ScoreTeam({ side, dim }: { side: ScoreSide; dim: boolean }) {
  const team = side.team ? TEAMS_BY_KEY.get(side.team) : undefined;
  const colors = team ? panelColors(team) : null;
  const logo = team ? `/teams/${team.key}.png` : side.logo;
  return (
    <span className={`score-side${dim ? ' is-dim' : ''}`}>
      <b className={colors ? 'score-team' : 'score-team is-plain'} style={colors ? ({ '--team-bg': colors.background, '--team-fg': colors.text } as CSSProperties) : undefined}>
        {/* oxlint-disable-next-line next/no-img-element */}
        {logo && <img className="ticker-team-logo" src={logo} alt="" onError={hideOnError} />}
        {side.rank && <small>{side.rank}</small>}
        {side.abbr}
      </b>
      {side.score !== null && <span className="score-num">{side.score}</span>}
    </span>
  );
}

const LEAGUE_LABEL: Record<ScoreItem['league'], string> = { NFL: 'NFL', NBA: 'NBA', MLB: 'MLB', NHL: 'NHL', CFB: 'COLLEGE FB', CBB: 'COLLEGE BB' };

function ScoreItems({ games }: { games: ScoreItem[] }) {
  return games.map((game, index) => {
    const final = game.state === 'final';
    const newLeague = index === 0 || games[index - 1].league !== game.league;
    return (
      <span className="ticker-item score-item" key={game.id}>
        {newLeague && <strong>{LEAGUE_LABEL[game.league]}</strong>}
        <ScoreTeam side={game.away} dim={final && game.home.winner} />
        <ScoreTeam side={game.home} dim={final && game.away.winner} />
        <span className={`score-detail is-${game.state}`}>{game.detail}</span>
        <i aria-hidden="true" />
      </span>
    );
  });
}

function TextPromo({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const content = ref.current;
    const parent = content?.parentElement;
    if (!content || !parent) return;
    const fit = () => {
      content.style.transform = `scale(${Math.min(1, Math.max(1, parent.clientWidth - 48) / Math.max(1, content.scrollWidth))})`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    observer.observe(content);
    fit();
    return () => observer.disconnect();
  }, [text]);
  // @handles get the accent color.
  const parts = text.split(/(@[\w.]+)/g);
  return (
    <div className="promo-text">
      <span ref={ref} className="promo-text-content">{parts.map((part, index) => (part.startsWith('@') ? <span key={index} className="promo-handle">{part}</span> : part))}</span>
    </div>
  );
}

export function Ticker() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [games, setGames] = useState<ScoreItem[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<TickerSettings>(defaultSettings);
  const [scrollDuration, setScrollDuration] = useState(140);
  const [repeatCount, setRepeatCount] = useState(1);
  const [previewOverride, setPreviewOverride] = useState<Partial<TickerSettings> | null>(null);
  const [scene, setScene] = useState<Scene>({ kind: 'news', run: 0 });
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const firstLoad = useRef(true);
  const groupRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<Segment, number>>({ news: 0, scores: 0 });
  const poll = useRef(createJsonPoller());
  const scoresReceivedAt = useRef(0);

  const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('preview');
  const view: TickerSettings = previewOverride ? { ...settings, ...previewOverride } : settings;

  // Latest data for the cycle loop, which runs outside React renders.
  const live = useRef({ headlines, games, promos, view, scene, scrollDuration });
  useEffect(() => {
    live.current = { headlines, games, promos, view, scene, scrollDuration };
  });

  // Each source loads on its own and keeps its last good copy when a request fails.
  const loadNews = useCallback(async () => {
    try {
      // Preview mode (control panel) must never consume "play next" headlines meant for OBS.
      const consume = firstLoad.current && !new URLSearchParams(window.location.search).has('preview');
      const data = await poll.current<{ headlines?: Headline[] }>(`/api/headlines${consume ? '?consumeNext=1' : ''}`);
      // Always replace the list — keeping the old one when it came back empty left deleted
      // custom headlines on screen.
      if (Array.isArray(data.headlines)) setHeadlines(data.headlines);
      firstLoad.current = false;
    } catch {
      // keep what's on screen
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await poll.current<Partial<TickerSettings>>('/api/settings');
      setSettings({ ...defaultSettings, ...data });
    } catch {
      // keep current look
    }
  }, []);

  const loadPromos = useCallback(async () => {
    try {
      const list = await poll.current<Promo[]>('/api/promos');
      if (Array.isArray(list)) setPromos(list);
    } catch {
      // keep current promos
    }
  }, []);

  const loadScores = useCallback(async () => {
    try {
      const data = await poll.current<{ games?: ScoreItem[] }>('/api/scores');
      if (Array.isArray(data.games)) {
        setGames(data.games);
        scoresReceivedAt.current = Date.now();
      }
    } catch {
      // An extended connection failure must not leave frozen scores presented as live forever.
      if (Date.now() - scoresReceivedAt.current > 20 * 60_000) setGames([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.allSettled([loadNews(), loadSettings(), loadPromos()]);
  }, [loadNews, loadSettings, loadPromos]);

  useEffect(() => {
    // Show the branded fallback promptly even if one upstream request never answers.
    const startup = window.setTimeout(() => setReady(true), 2500);
    void Promise.allSettled([loadAll(), loadScores()]).then(() => setReady(true));
    const timer = window.setInterval(loadAll, POLL_MS);
    const scoresTimer = window.setInterval(loadScores, SCORES_POLL_MS);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(scoresTimer);
      window.clearTimeout(startup);
    };
  }, [loadAll, loadScores]);

  // ---- Promo files: preload each one; only promos that loaded fine ever go on air. ----
  const mediaState = useRef(new Map<string, { status: 'loading' | 'ready' | 'failed'; at: number }>());
  const mediaCleanup = useRef(new Set<() => void>());
  useEffect(() => () => { for (const cleanup of mediaCleanup.current) cleanup(); }, []);
  useEffect(() => {
    for (const promo of promos) {
      if (!promo.enabled || promo.kind === 'text' || !promo.url) continue;
      const url = promo.url;
      const known = mediaState.current.get(url);
      if (known && (known.status !== 'failed' || Date.now() - known.at < PROMO_RETRY_MS)) continue;
      mediaState.current.set(url, { status: 'loading', at: Date.now() });
      let release = () => {};
      const cleanup = () => {
        window.clearTimeout(timer);
        release();
        mediaCleanup.current.delete(cleanup);
      };
      const settle = (status: 'ready' | 'failed') => {
        if (mediaState.current.get(url)?.status === 'loading') mediaState.current.set(url, { status, at: Date.now() });
        cleanup();
      };
      const timer = window.setTimeout(() => settle('failed'), PROMO_LOAD_TIMEOUT_MS);
      mediaCleanup.current.add(cleanup);
      if (promo.kind === 'image') {
        const image = new Image();
        release = () => { image.onload = null; image.onerror = null; image.removeAttribute('src'); };
        image.onload = () => settle('ready');
        image.onerror = () => settle('failed');
        image.src = url;
      } else {
        const video = document.createElement('video');
        release = () => { video.oncanplaythrough = null; video.onerror = null; video.removeAttribute('src'); video.load(); };
        video.muted = true;
        video.preload = 'auto';
        video.oncanplaythrough = () => settle('ready');
        video.onerror = () => settle('failed');
        video.src = url;
        video.load();
      }
    }
  }, [promos]);

  // ---- The cycle: segment → promo → other segment → next promo → … ----
  const endPromo = useRef<(() => void) | null>(null);
  const skipSegment = useRef<(() => void) | null>(null);
  const forcedPromo = useRef<Promo | null>(null);
  const manualSkip = useRef(false);
  const promoIndex = useRef(0);
  const failedPromo = useRef<number | null>(null);

  const pickPromo = useCallback((): Promo | null => {
    if (forcedPromo.current) {
      const forced = forcedPromo.current;
      forcedPromo.current = null;
      return forced;
    }
    const list = live.current.promos.filter((promo) => promo.enabled && (promo.kind === 'text' ? promo.text.trim() : promo.url));
    for (let tries = 0; tries < list.length; tries += 1) {
      const promo = list[(promoIndex.current + tries) % list.length];
      const ok = promo.kind === 'text' || mediaState.current.get(promo.url ?? '')?.status === 'ready';
      if (ok) {
        promoIndex.current = (promoIndex.current + tries + 1) % list.length;
        return promo;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const waiter = createSceneWaiter();
    const wait = waiter.wait;
    const hasScores = () => live.current.view.scoresEnabled && live.current.games.length > 0;
    let runId = 0;
    // Crossfade: the old scene fades out while the new one fades in on top, so the bar is never empty.
    let showing: Scene = live.current.scene;
    const crossfadeTo = async (to: Scene) => {
      const group = groupRef.current;
      const track = group?.parentElement;
      const displayedSegment = track?.dataset.segment as Segment | undefined;
      if (group && track && displayedSegment && group.scrollWidth > 0) {
        const transform = getComputedStyle(track).transform;
        const offset = transform === 'none' ? 0 : Math.abs(new DOMMatrixReadOnly(transform).m41);
        scrollPositions.current[displayedSegment] = offset % group.scrollWidth;
      }
      // Resume each strip across promo/score breaks; otherwise short segments starve later items.
      const incoming: Scene = to.kind === 'promo' ? to : {
        ...to, offset: showing.kind === to.kind ? 0 : scrollPositions.current[to.kind],
      };
      setLeaving({ scene: showing, duration: live.current.scrollDuration });
      setScene(incoming);
      showing = incoming;
      await wait(FADE_MS);
      if (!cancelled) setLeaving(null);
    };

    async function run() {
      // Starts on news (an empty news strip shows scores instead, see `segmentFor` below).
      let current: Segment = 'news';
      while (!cancelled) {
        await wait(Math.max(live.current.view.segmentSeconds, 10) * 1000, skipSegment);
        if (cancelled) return;
        const next: Segment = current === 'news' ? (hasScores() ? 'scores' : 'news') : 'news';
        const promo = pickPromo();
        // Nothing to switch to and no promo: keep the strip scrolling without a break
        // (unless "Skip ahead" was pressed — then restart the strip so the press visibly does something).
        const manual = manualSkip.current;
        manualSkip.current = false;
        if (!promo && next === current && !manual) continue;
        if (promo) {
          await crossfadeTo({ kind: 'promo', promo, run: (runId += 1) });
          if (cancelled) return;
          // A media error may arrive during the entrance fade, before endPromo is installed.
          if (failedPromo.current !== promo.id) await wait(Math.max(live.current.view.promoSeconds, 2) * 1000, endPromo);
          failedPromo.current = null;
          if (cancelled) return;
        }
        current = next;
        await crossfadeTo({ kind: current, run: (runId += 1) });
      }
    }
    void run();
    return () => {
      cancelled = true;
      waiter.cancel();
    };
  }, [ready, pickPromo]);

  // A promo whose file breaks while on air ends early (fades straight to the next segment).
  const promoFailed = useCallback(() => {
    const current = live.current.scene;
    if (current.kind === 'promo') {
      failedPromo.current = current.promo.id;
      if (current.promo.url) mediaState.current.set(current.promo.url, { status: 'failed', at: Date.now() });
    }
    endPromo.current?.();
  }, []);

  // "Skip ahead" button on the control panel: end the current segment or promo now. The normal
  // crossfade to whatever comes next follows. A press during a crossfade is ignored.
  const advance = useCallback(() => {
    if (skipSegment.current) {
      manualSkip.current = true;
      skipSegment.current();
    } else {
      endPromo.current?.();
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    let lastSeq: number | null = null;
    const check = async () => {
      try {
        const { seq } = await poll.current<{ seq: number | null }>('/api/advance');
        if (typeof seq !== 'number') return;
        // The first answer is only the starting point, so reloading OBS never skips by itself.
        if (lastSeq !== null && seq > lastSeq) advance();
        lastSeq = Math.max(lastSeq ?? seq, seq);
      } catch {
        // missed one check; the next one catches up
      }
    };
    void check();
    const timer = window.setInterval(check, ADVANCE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [ready, advance]);

  // Preview mode: the control panel streams unsaved settings in, asks for refreshes, and can show a promo now.
  useEffect(() => {
    if (!isPreview || window.parent === window) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const data = event.data as { type?: string; settings?: Partial<TickerSettings>; promo?: Promo } | null;
      if (data?.type === 'ticker-preview:settings' && data.settings) setPreviewOverride(data.settings);
      if (data?.type === 'ticker-preview:refresh') {
        void loadAll();
        void loadScores();
      }
      if (data?.type === 'ticker-preview:promo' && data.promo) {
        forcedPromo.current = data.promo;
        if (skipSegment.current) skipSegment.current();
        else endPromo.current?.();
      }
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'ticker-preview:ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [isPreview, loadAll, loadScores]);

  // Which strip to scroll. A segment with nothing in it shows the other one instead.
  const segmentFor = (target: Scene): Segment | null =>
    target.kind === 'promo' ? null
      : target.kind === 'scores' && view.scoresEnabled && games.length > 0 ? 'scores'
        : headlines.length > 0 ? 'news'
          : view.scoresEnabled && games.length > 0 ? 'scores'
            : null;
  const segment = segmentFor(scene);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => {
      const unit = group.firstElementChild?.getBoundingClientRect().width ?? 0;
      const viewport = group.closest('.ticker-window')?.clientWidth ?? window.innerWidth;
      const repeats = unit > 0 ? Math.max(1, Math.ceil(viewport / unit)) : 1;
      setRepeatCount(repeats);
      setScrollDuration(Math.max(unit * repeats / view.scrollSpeed, 8));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    if (group.firstElementChild) observer.observe(group.firstElementChild);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [ready, segment, scene.run, headlines, games, view.scrollSpeed, view.fontSize, view.fontFamily]);

  if (!ready) return null;

  const shellStyle = {
    '--ticker-accent': view.accentColor,
    '--ticker-background': view.backgroundColor,
    '--ticker-text': view.textColor,
    '--ticker-font': view.fontFamily === 'Geist' ? 'var(--font-geist-sans)' : view.fontFamily,
    '--ticker-size': `${view.fontSize}px`,
    '--fade-ms': `${FADE_MS}ms`,
  } as CSSProperties;

  // Both the scene fading out (if any) and the current one, oldest first so the new one is on top.
  const layers = [
    ...(leaving ? [{ scene: leaving.scene, duration: leaving.duration, out: true }] : []),
    { scene, duration: scrollDuration, out: false },
  ];

  // Strip contents (news, scores, text promo) crossfade inside the bar; the logo block stays put.
  const stripLayers = layers.filter((layer) => !isMediaPromo(layer.scene)).map(({ scene: layerScene, duration, out }) => {
    const layerSegment = segmentFor(layerScene);
    const items = layerSegment === 'scores' ? <ScoreItems games={games} /> : <NewsItems headlines={headlines} />;
    return (
      <div key={sceneKey(layerScene)} className={`strip-layer ${out ? 'is-leaving' : 'is-entering'}`} style={{ '--ticker-duration': `${duration}s` } as CSSProperties}>
        <Quiet key={layerSegment ?? 'none'} onError={out ? undefined : promoFailed}>
          {layerScene.kind === 'promo' ? (
            <TextPromo text={layerScene.promo.text} />
          ) : layerSegment ? (
            <div className="ticker-track" data-segment={layerSegment} style={{ animationDelay: `${-(layerScene.offset ?? 0) / view.scrollSpeed}s` }}>
              <div ref={out ? undefined : groupRef} className="ticker-group">{Array.from({ length: repeatCount }, (_, index) => <div className="ticker-unit" key={index}>{items}</div>)}</div>
              <div className="ticker-group" aria-hidden="true">{Array.from({ length: repeatCount }, (_, index) => <div className="ticker-unit" key={index}>{items}</div>)}</div>
            </div>
          ) : <TextPromo text="Welcome to Lasorda's Card House" />}
        </Quiet>
      </div>
    );
  });

  // Uploaded image / GIF / video promos fill the whole 1920×60 browser source, over the bar.
  const mediaLayers = layers.filter((layer) => isMediaPromo(layer.scene)).map(({ scene: layerScene, out }) => {
    if (layerScene.kind !== 'promo' || !layerScene.promo.url) return null;
    const { promo } = layerScene;
    return (
      <div key={sceneKey(layerScene)} className={`media-layer ${out ? 'is-leaving' : 'is-entering'}`}>
        <Quiet onError={out ? undefined : promoFailed}>
          {promo.kind === 'video' ? (
            <video className="promo-media" src={promo.url ?? undefined} autoPlay muted loop playsInline onError={out ? undefined : promoFailed} />
          ) : (
            // oxlint-disable-next-line next/no-img-element
            <img className="promo-media" src={promo.url ?? undefined} alt="" onError={(event) => { hideOnError(event); if (!out) promoFailed(); }} />
          )}
        </Quiet>
      </div>
    );
  });

  return (
    <div className="ticker-stage" style={shellStyle}>
      {/* The bar fades out under a full-size media promo and back in after it. */}
      <main className={`ticker-shell${isMediaPromo(scene) ? ' is-hidden' : ''}`} aria-label="Live sports ticker">
        <Brand />
        <div className="ticker-window">{stripLayers}</div>
      </main>
      {mediaLayers}
    </div>
  );
}
