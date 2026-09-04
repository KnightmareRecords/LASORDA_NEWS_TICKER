'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Palette, Plus, Radio, RefreshCw, Trash2, Zap } from 'lucide-react';
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
  const [previewVersion, setPreviewVersion] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await fetch('/api/custom', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load custom headlines.');
      setItems(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  useEffect(() => {
    void fetch('/api/settings', { cache: 'no-store' })
      .then((response) => response.json() as Promise<TickerSettings>)
      .then(setSettings)
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
    setAdminKey(window.sessionStorage.getItem('ticker-admin-key') || '');
  }, []);

  function saveAdminKey(value: string) {
    setAdminKey(value);
    window.sessionStorage.setItem('ticker-admin-key', value);
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
      setSettings(await response.json() as TickerSettings);
      setPreviewVersion(Date.now());
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
    }
  }

  async function remove(id: number) {
    setItems((current) => current.filter((item) => item.id !== id));
    const response = await fetch(`/api/custom/${id}`, { method: 'DELETE', headers: { 'X-Admin-Key': adminKey } });
    if (!response.ok) {
      setError('That headline could not be removed.');
      await load();
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
            <Button className="bg-[#ffb000] text-black hover:bg-[#ffc13b]" onClick={() => window.open('/ticker', '_blank')}>
              Preview ticker <ExternalLink />
            </Button>
          </div>
        </header>

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
                  <Button aria-label={`Delete ${item.text}`} size="icon-sm" variant="ghost" className="text-slate-500 hover:bg-red-400/10 hover:text-red-300" onClick={() => remove(item.id)}><Trash2 /></Button>
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

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101520]">
              <div className="border-b border-white/10 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Live preview</p></div>
              <div className="relative h-48 bg-[radial-gradient(circle_at_40%_20%,#26364c,#0b1018_60%)]">
                <iframe title="Ticker preview" src={`/ticker?preview=${previewVersion}`} className="absolute inset-x-0 bottom-4 h-20 w-full border-0" />
              </div>
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
