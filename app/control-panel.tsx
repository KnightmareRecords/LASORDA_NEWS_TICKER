'use client';

import { FormEvent, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Check, Copy, Download, ExternalLink, MonitorPlay, Palette, Plus, Radio, RefreshCw, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

type CustomHeadline = {
  id: number;
  text: string;
  enabled: boolean;
  placement: 'rotation' | 'next';
  createdAt: number;
};

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

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const defaultSettings: TickerSettings = {
  accentColor: '#ffb000',
  backgroundColor: '#0a0e16',
  textColor: '#ffffff',
  fontFamily: 'Geist',
  fontSize: 25,
  scrollSpeed: 90,
  feedUrl: 'https://news.google.com/rss/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRFp1ZEdvU0JXVnVMVlZUR2dKVlV5Z0FQAQ?hl=en-US&gl=US&ceid=US:en',
  feedLabel: 'SPORTS',
};

type ModelContext = {
  registerTool: (tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => Promise<unknown>;
  }, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

export function ControlPanel() {
  const [items, setItems] = useState<CustomHeadline[]>([]);
  const [headline, setHeadline] = useState('');
  const [placement, setPlacement] = useState<'rotation' | 'next'>('rotation');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [settings, setSettings] = useState<TickerSettings>(defaultSettings);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [savedSettings, setSavedSettings] = useState<TickerSettings>(defaultSettings);
  const [feedStatus, setFeedStatus] = useState<{ ok: boolean; count: number; error: string | null } | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const settingsRef = useRef(settings);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  const postToPreview = useCallback((message: object) => {
    previewRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);
  const checkFeed = useCallback(async () => {
    try {
      const response = await fetch('/api/headlines', { cache: 'no-store' });
      const data = (await response.json()) as { headlines: { source: string }[]; feedAvailable: boolean; feedError?: string | null };
      setFeedStatus({ ok: data.feedAvailable, count: data.headlines.filter((item) => item.source !== 'LIVE').length, error: data.feedError ?? null });
    } catch {
      setFeedStatus(null);
    }
  }, []);
  const refreshPreview = useCallback(() => postToPreview({ type: 'ticker-preview:refresh' }), [postToPreview]);

  useEffect(() => void checkFeed(), [checkFeed]);

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await fetch('/api/custom', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load custom headlines.');
      setItems(await response.json());
      refreshPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [refreshPreview]);

  useEffect(() => void load(), [load]);

  // Live preview: push every (unsaved) appearance change into the preview ticker.
  useEffect(() => {
    settingsRef.current = settings;
    postToPreview({ type: 'ticker-preview:settings', settings });
  }, [settings, postToPreview]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== previewRef.current?.contentWindow) return;
      if ((event.data as { type?: string } | null)?.type === 'ticker-preview:ready') {
        postToPreview({ type: 'ticker-preview:settings', settings: settingsRef.current });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postToPreview]);

  useEffect(() => {
    void fetch('/api/settings', { cache: 'no-store' })
      .then((response) => response.json() as Promise<TickerSettings>)
      .then((loaded) => {
        setSettings(loaded);
        setSavedSettings(loaded);
      })
      .catch(() => setError('Could not load ticker appearance.'));
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capturePrompt);
    return () => window.removeEventListener('beforeinstallprompt', capturePrompt);
  }, []);

  useEffect(() => {
    const savedKey = window.localStorage.getItem('ticker-admin-key') || window.sessionStorage.getItem('ticker-admin-key') || '';
    setAdminKey(savedKey);
    if (savedKey) window.localStorage.setItem('ticker-admin-key', savedKey);
  }, []);

  function saveAdminKey(value: string) {
    setAdminKey(value);
    if (value) window.localStorage.setItem('ticker-admin-key', value);
    else window.localStorage.removeItem('ticker-admin-key');
    window.sessionStorage.removeItem('ticker-admin-key');
  }

  async function saveAppearance() {
    setAppearanceSaving(true);
    setError('');
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Could not save appearance. Check your admin key.');
      const saved = await response.json() as TickerSettings;
      setSettings(saved);
      setSavedSettings(saved);
      refreshPreview();
      void checkFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setAppearanceSaving(false);
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: 'add_custom_ticker_headline',
      title: 'Add custom ticker headline',
      description: 'Add a stream announcement to the live ticker, either in normal rotation or at the front once.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 180 },
          placement: { type: 'string', enum: ['rotation', 'next'] },
        },
        required: ['text'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const candidate = input as { text?: unknown; placement?: unknown };
        if (typeof candidate.text !== 'string' || !candidate.text.trim() || candidate.text.length > 180) {
          throw new Error('Headline text must be between 1 and 180 characters.');
        }
        const selectedPlacement = candidate.placement === 'next' ? 'next' : 'rotation';
        const response = await fetch('/api/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
          body: JSON.stringify({ text: candidate.text.trim(), placement: selectedPlacement }),
        });
        if (!response.ok) throw new Error('The headline could not be added.');
        await load();
        const created = await response.json() as CustomHeadline;
        return { id: created.id, text: created.text, placement: created.placement };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [adminKey, load]);

  async function addHeadline(event: FormEvent) {
    event.preventDefault();
    const clean = headline.trim();
    if (!clean) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ text: clean, placement }),
      });
      if (!response.ok) throw new Error('Could not add the headline.');
      setHeadline('');
      setPlacement('rotation');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function update(id: number, patch: Partial<Pick<CustomHeadline, 'enabled' | 'placement'>>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    const response = await fetch(`/api/custom/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setError('That change did not save.');
      await load();
    } else {
      refreshPreview();
    }
  }

  async function remove(id: number) {
    if (!adminKey) {
      setError('Enter your admin key before deleting a headline.');
      return;
    }
    setDeletingId(id);
    setError('');
    try {
      const response = await fetch(`/api/custom/${id}`, { method: 'DELETE', headers: { 'X-Admin-Key': adminKey } });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || 'That headline could not be removed.');
      }
      setItems((current) => current.filter((item) => item.id !== id));
      refreshPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That headline could not be removed.');
    } finally {
      setDeletingId(null);
    }
  }

  async function copyTickerUrl() {
    await navigator.clipboard.writeText(`${window.location.origin}/ticker`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="min-h-screen bg-[#080b12] text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="mb-9 flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#ffb000]">
              <Radio className="size-4" /> Live broadcast tools
            </div>
            <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Ticker control</h1>
            <p className="mt-3 max-w-2xl text-base text-slate-400">Import any RSS news feed and mix in your own stream announcements.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {installPrompt && (
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={installApp}>
                <Download /> Install app
              </Button>
            )}
            <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={copyTickerUrl}>
              {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy OBS URL'}
            </Button>
            <Button className="bg-[#ffb000] text-black hover:bg-[#ffc13b]" onClick={() => window.open('/ticker?preview=1', '_blank')}>
              Preview ticker <ExternalLink />
            </Button>
          </div>
        </header>

        <PreviewStage
          frameRef={previewRef}
          unsaved={JSON.stringify(settings) !== JSON.stringify(savedSettings)}
          feedChanged={settings.feedUrl !== savedSettings.feedUrl || settings.feedLabel !== savedSettings.feedLabel}
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <div className="rounded-2xl border border-white/10 bg-[#101520] p-5 shadow-2xl shadow-black/20 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Custom headlines</h2>
                <p className="mt-1 text-sm text-slate-400">Your enabled items are mixed between ESPN stories.</p>
              </div>
              <Button aria-label="Refresh list" size="icon" variant="ghost" className="text-slate-400 hover:bg-white/10 hover:text-white" onClick={load}><RefreshCw /></Button>
            </div>

            {error && <p role="alert" className="mb-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}

            <div className="mb-4">
              <label htmlFor="admin-key" className="mb-2 block text-sm font-medium text-slate-200">Admin key</label>
              <Input id="admin-key" type="password" value={adminKey} onChange={(event) => saveAdminKey(event.target.value)} placeholder="Enter your private editing key" autoComplete="off" className="h-10 border-white/15 bg-white/5 text-white placeholder:text-slate-600" />
              <p className="mt-1.5 text-xs text-slate-500">Required only for adding or changing headlines. The OBS ticker does not need it.</p>
            </div>

            <form onSubmit={addHeadline} className="mb-7 rounded-xl border border-white/10 bg-black/20 p-4">
              <label htmlFor="headline" className="mb-2 block text-sm font-medium text-slate-200">New headline</label>
              <Input id="headline" value={headline} maxLength={180} onChange={(event) => setHeadline(event.target.value)} placeholder="Example: $5 starts on every card for the next 10 minutes" className="h-11 border-white/15 bg-white/5 text-white placeholder:text-slate-600" />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <Switch checked={placement === 'next'} onCheckedChange={(checked) => setPlacement(checked ? 'next' : 'rotation')} />
                  <Zap className="size-4 text-[#ffb000]" /> Put at the front once
                </label>
                <Button type="submit" disabled={saving || !headline.trim() || !adminKey} className="h-10 bg-[#ffb000] px-4 text-black hover:bg-[#ffc13b]">
                  <Plus /> {saving ? 'Adding…' : 'Add to ticker'}
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading headlines…</p> : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 py-10 text-center text-sm text-slate-500">No custom headlines yet.</div>
              ) : items.map((item) => (
                <article key={item.id} className={`flex items-start gap-3 rounded-xl border p-4 transition ${item.enabled ? 'border-white/10 bg-white/[0.035]' : 'border-white/5 bg-transparent opacity-55'}`}>
                  <Switch aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.text}`} checked={item.enabled} onCheckedChange={(enabled) => update(item.id, { enabled })} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[15px] leading-6 text-slate-100">{item.text}</p>
                    <button type="button" onClick={() => update(item.id, { placement: item.placement === 'next' ? 'rotation' : 'next' })} className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${item.placement === 'next' ? 'bg-[#ffb000]/15 text-[#ffc13b]' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>
                      <Zap className="size-3" /> {item.placement === 'next' ? 'Plays first next refresh' : 'Normal rotation'}
                    </button>
                  </div>
                  <Button type="button" aria-label={`Delete ${item.text}`} disabled={deletingId !== null} size="icon-sm" variant="ghost" className="text-slate-500 hover:bg-red-400/10 hover:text-red-300" onClick={() => remove(item.id)}><Trash2 /></Button>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-[#101520] p-5">
              <div className="mb-5 flex items-center gap-2">
                <Radio className="size-4 text-[#ffb000]" />
                <h2 className="font-semibold">News feed</h2>
              </div>
              <label htmlFor="feed-url" className="text-xs font-medium text-slate-400">
                RSS or Atom URL
                <Input id="feed-url" type="url" value={settings.feedUrl} onChange={(event) => setSettings((current) => ({ ...current, feedUrl: event.target.value }))} className="mt-2 h-10 border-white/10 bg-white/5 text-white" />
              </label>
              <label htmlFor="feed-label" className="mt-4 block text-xs font-medium text-slate-400">
                On-screen label
                <Input id="feed-label" value={settings.feedLabel} maxLength={18} onChange={(event) => setSettings((current) => ({ ...current, feedLabel: event.target.value.toUpperCase() }))} placeholder="SPORTS" className="mt-2 h-10 border-white/10 bg-white/5 text-white" />
              </label>
              {feedStatus && (feedStatus.ok ? (
                <p className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-200/80">Feed working — {feedStatus.count} headlines loaded.</p>
              ) : (
                <p role="alert" className="mt-3 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-200">Feed not loading: {feedStatus.error || 'unknown error'} Only your custom headlines are showing.</p>
              ))}
              <p className="mt-3 text-xs leading-5 text-slate-500">Use a direct feed URL beginning with http:// or https://. Changing feeds does not change your custom headlines.</p>
              <Button disabled={!adminKey || appearanceSaving || !settings.feedUrl.trim()} onClick={saveAppearance} className="mt-4 h-10 w-full bg-[#ffb000] text-black hover:bg-[#ffc13b]">
                {appearanceSaving ? 'Saving…' : 'Save news feed'}
              </Button>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#101520] p-5">
              <div className="mb-5 flex items-center gap-2">
                <Palette className="size-4 text-[#ffb000]" />
                <h2 className="font-semibold">Ticker appearance</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([
                  ['accentColor', 'Accent'],
                  ['backgroundColor', 'Background'],
                  ['textColor', 'Text'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="text-xs font-medium text-slate-400">
                    {label}
                    <span className="mt-2 flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2">
                      <input type="color" value={settings[key]} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" />
                      <span className="hidden font-mono text-[10px] text-slate-500 xl:inline">{settings[key]}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-slate-400">
                  Font
                  <Select value={settings.fontFamily} onValueChange={(value) => setSettings((current) => ({ ...current, fontFamily: value || 'Geist' }))}>
                    <SelectTrigger className="mt-2 h-10 w-full border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Geist', 'Arial', 'Impact', 'Georgia', 'Courier New'].map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-xs font-medium text-slate-400">
                  Text size
                  <Select value={String(settings.fontSize)} onValueChange={(value) => setSettings((current) => ({ ...current, fontSize: Number(value || 25) }))}>
                    <SelectTrigger className="mt-2 h-10 w-full border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[20, 22, 25, 28, 32, 36].map((size) => <SelectItem key={size} value={String(size)}>{size}px</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="scroll-speed" className="text-xs font-medium text-slate-400">Scroll speed</label>
                  <span className="font-mono text-xs text-[#ffb000]">{settings.scrollSpeed} px/s</span>
                </div>
                <Slider
                  id="scroll-speed"
                  aria-label="Ticker scroll speed"
                  min={30}
                  max={180}
                  step={10}
                  value={[settings.scrollSpeed]}
                  onValueChange={(value) => setSettings((current) => ({ ...current, scrollSpeed: Array.isArray(value) ? value[0] : value }))}
                  className="mt-4"
                />
                <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Slower</span><span>Faster</span></div>
              </div>
              <Button disabled={!adminKey || appearanceSaving} onClick={saveAppearance} className="mt-4 h-10 w-full bg-[#ffb000] text-black hover:bg-[#ffc13b]">
                {appearanceSaving ? 'Saving…' : 'Save appearance'}
              </Button>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#101520] p-5">
              <h2 className="font-semibold">OBS setup</h2>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                <li><span className="mr-2 font-mono text-[#ffb000]">01</span> Add a Browser Source to your scene.</li>
                <li><span className="mr-2 font-mono text-[#ffb000]">02</span> Use the ticker URL and set width to 1920, height to 120.</li>
                <li><span className="mr-2 font-mono text-[#ffb000]">03</span> Position it along the bottom edge.</li>
              </ol>
              <div className="mt-5 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-xs leading-5 text-emerald-200/80">The overlay background is transparent. ESPN refreshes every 30 minutes; custom changes reach OBS within 15 seconds.</div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-[#101520] p-5">
              <h2 className="font-semibold">Install on your computer</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">In Chrome or Edge, open the browser menu and choose <strong className="text-slate-200">Install Live Ticker Control</strong>. On a Mac using Safari, choose <strong className="text-slate-200">File → Add to Dock</strong>.</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
// Show only the lower part of the 1080p frame (where the ticker lives) so the preview stays compact.
const VISIBLE_HEIGHT = 360;

function PreviewStage({ frameRef, unsaved, feedChanged }: { frameRef: RefObject<HTMLIFrameElement | null>; unsaved: boolean; feedChanged: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // ResizeObserver fires once on observe(), so this also sets the initial scale.
    const observer = new ResizeObserver(() => setScale(box.clientWidth / STAGE_WIDTH));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#101520]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <MonitorPlay className="size-4 text-[#ffb000]" />
          <h2 className="font-semibold">Live preview</h2>
          <span className="text-xs text-slate-500">bottom of a 1920 × 1080 stream</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {unsaved ? (
            <span className="rounded-full bg-[#ffb000]/15 px-2.5 py-1 font-semibold text-[#ffc13b]">Unsaved changes — not on stream yet</span>
          ) : (
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 font-semibold text-emerald-300">Matches what OBS shows</span>
          )}
          {feedChanged && <span className="rounded-full bg-white/5 px-2.5 py-1 text-slate-400">New feed headlines load after saving</span>}
        </div>
      </div>
      <div ref={boxRef} className="relative w-full overflow-hidden bg-[radial-gradient(circle_at_35%_25%,#26364c,#0b1018_65%)]" style={{ aspectRatio: `${STAGE_WIDTH} / ${VISIBLE_HEIGHT}` }}>
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(transparent_49.5%,rgb(255_255_255/4%)_50%,transparent_50.5%),linear-gradient(90deg,transparent_49.5%,rgb(255_255_255/4%)_50%,transparent_50.5%)]" />
        <iframe
          ref={frameRef}
          title="Ticker preview"
          src="/ticker?preview=1"
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          className="absolute bottom-0 left-0 origin-bottom-left border-0 bg-transparent"
          style={{ transform: `scale(${scale})` }}
        />
      </div>
      <p className="px-5 py-3 text-xs text-slate-500">Preview never uses up your “front once” headlines — only the OBS source does.</p>
    </section>
  );
}
