import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Cpu,
  HeartPulse,
  MessageCircle,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  getGetMaternaStatusQueryKey,
  useGetMaternaStatus,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  Router as WouterRouter,
  useLocation,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  const statusQuery = useGetMaternaStatus({
    query: {
      queryKey: getGetMaternaStatusQueryKey(),
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
      retry: 2,
    },
  });
  const { data, error, isLoading, isFetching, refetch } = statusQuery;
  const [isResettingPairing, setIsResettingPairing] = useState(false);
  const [pairingResetError, setPairingResetError] = useState<string | null>(null);
  const checkedLabel = useMemo(
    () => (isFetching ? 'Checking live status' : 'Live status · updates every 5 sec'),
    [isFetching],
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !data) {
    return (
      <div className="materna-shell min-h-[100dvh] p-5 text-foreground sm:p-8">
        <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-6xl items-center justify-center">
          <section className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-8 text-center shadow-[0_24px_70px_hsl(247_29%_24%_/_0.1)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--destructive)/0.12)] text-destructive">
              <AlertCircle size={26} aria-hidden="true" />
            </div>
            <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Afeeyah AI operations
            </p>
            <h1 className="mt-3 font-serif text-3xl text-foreground">Status is taking a moment</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              We could not reach the pairing service. The operator view will be ready as soon as the service responds.
            </p>
            <button
              type="button"
              data-testid="button-retry-status"
              onClick={() => void refetch()}
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
            <p className="mt-4 font-mono text-[10px] text-muted-foreground">
              {error instanceof Error ? error.message : 'Connection unavailable'}
            </p>
          </section>
        </div>
      </div>
    );
  }

  const whatsappConnected = data.whatsapp.connected;
  const hasQr = Boolean(data.whatsapp.qr);
  const statusTone = whatsappConnected
    ? 'connected'
    : data.whatsapp.status === 'error'
      ? 'error'
      : hasQr
        ? 'pairing'
        : 'waiting';

  return (
    <div className="materna-shell min-h-[100dvh] text-foreground">
      <div className="materna-grid pointer-events-none fixed inset-0 opacity-70" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[100dvh] max-w-[1440px]">
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[hsl(var(--sidebar-border)/0.7)] bg-sidebar px-5 py-6 text-sidebar-foreground lg:flex">
          <BrandMark />
          <div className="mt-14">
            <p className="px-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/50">
              Workspace
            </p>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-sidebar-accent px-3 py-3 text-sm font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-sidebar-primary-foreground">
                <Activity size={16} aria-hidden="true" />
              </span>
              <span className="flex-1">Overview</span>
              <ChevronRight size={15} className="text-sidebar-foreground/50" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="status-dot-live h-2 w-2 rounded-full bg-[hsl(var(--sidebar-primary))]" />
              Service heartbeat
            </div>
            <p className="mt-2 text-xs leading-5 text-sidebar-foreground/60">
              A quiet place to keep the care line ready.
            </p>
            <div className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/45">
              <ShieldCheck size={13} aria-hidden="true" />
              Protected workspace
            </div>
          </div>
        </aside>

        <main className="w-full min-w-0 flex-1 px-5 pb-10 sm:px-8 lg:px-12 lg:py-9">
          <header className="flex items-center justify-between border-b border-border/80 py-5 lg:hidden">
            <BrandMark compact />
            <StatusPill tone={statusTone} />
          </header>

          <div className="mx-auto max-w-[1120px]">
            <header className="hidden items-end justify-between lg:flex">
              <div className="rise-in">
                <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />
                  Operator console / Lagos region
                </div>
                <h1 className="mt-4 font-serif text-[clamp(2.75rem,4vw,4.5rem)] leading-[0.96] tracking-[-0.045em] text-foreground">
                  Afeeyah AI <span className="text-[hsl(var(--accent))]">health support.</span>
                </h1>
                <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground">
                  A clear view of the WhatsApp health line and the support it provides to individuals and families.
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <StatusPill tone={statusTone} />
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground" data-testid="text-status-refresh">
                  <span className={`h-1.5 w-1.5 rounded-full ${isFetching ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--chart-2))]'}`} />
                  {checkedLabel}
                </span>
              </div>
            </header>

            <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:mt-12">
              <MetricCard
                icon={<MessageCircle size={18} aria-hidden="true" />}
                label="WhatsApp line"
                value={whatsappConnected ? 'Connected' : 'Needs pairing'}
                detail={whatsappConnected ? 'Ready for incoming care messages' : 'Scan the live code to connect'}
                tone={whatsappConnected ? 'teal' : 'coral'}
                testId="status-whatsapp"
              />
              <MetricCard
                icon={<Cpu size={18} aria-hidden="true" />}
                label="AI provider"
                value={data.ai.configured ? data.ai.provider || 'Configured' : 'Not configured'}
                detail={data.ai.configured ? 'Ready to assist conversations' : 'Provider setup needed'}
                tone={data.ai.configured ? 'plum' : 'sand'}
                testId="status-ai-provider"
              />
              <MetricCard
                icon={<Activity size={18} aria-hidden="true" />}
                label="Active sessions"
                value={data.sessions.toLocaleString()}
                detail="Conversations currently in flight"
                tone="gold"
                testId="status-sessions"
              />
            </div>

            <section className="mt-6" aria-labelledby="support-scope-title">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">How Afeeyah AI helps</p>
                  <h2 id="support-scope-title" className="mt-1 font-serif text-2xl tracking-[-0.025em]">Health support, made clear</h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <CapabilityCard number="01" title="Ask a health question" detail="Understandable, evidence-informed answers to common health concerns." />
                <CapabilityCard number="02" title="Women and family health" detail="Pregnancy, maternal wellbeing, child health, immunisation, and preventive care." />
                <CapabilityCard number="03" title="Know when to seek care" detail="Recognise potentially urgent symptoms and when to seek professional or emergency care." />
                <CapabilityCard number="04" title="Find healthcare services" detail="Facility guidance in Nigeria is planned and not available yet." upcoming />
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(350px,0.82fr)]">
              <div className="rise-in delay-1 overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_24px_70px_hsl(247_29%_24%_/_0.08)]">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-6 sm:px-8">
                  <div>
                    <div className="flex items-center gap-2 text-[hsl(var(--accent))]">
                      <QrCode size={17} aria-hidden="true" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Pairing station</span>
                    </div>
                    <h2 className="mt-3 font-serif text-3xl tracking-[-0.03em]">Connect the care line</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      {whatsappConnected
                        ? 'The Afeeyah AI number is paired and listening for new messages.'
                        : 'Use your phone to scan the current code. It refreshes while you wait.'}
                    </p>
                  </div>
                  <div className={`rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${whatsappConnected ? 'bg-[hsl(var(--chart-2)/0.13)] text-[hsl(var(--chart-2))]' : 'bg-[hsl(var(--accent)/0.14)] text-[hsl(14_55%_42%)]'}`} data-testid="text-pairing-state">
                    {whatsappConnected ? 'Paired' : hasQr ? 'Code ready' : 'Waiting'}
                  </div>
                </div>

                {whatsappConnected ? (
                  <ConnectedState
                    isResetting={isResettingPairing}
                    error={pairingResetError}
                    onReset={async () => {
                      if (isResettingPairing) return;
                      if (!window.confirm('Reset WhatsApp pairing and show a new QR code?')) return;
                      setIsResettingPairing(true);
                      setPairingResetError(null);
                      try {
                        const response = await fetch('/api/materna/whatsapp/reset', { method: 'POST' });
                        if (!response.ok) {
                          const body = (await response.json().catch(() => null)) as { error?: string } | null;
                          throw new Error(body?.error ?? 'Pairing reset failed.');
                        }
                        await refetch();
                      } catch (resetError) {
                        setPairingResetError(resetError instanceof Error ? resetError.message : 'Pairing reset failed.');
                      } finally {
                        setIsResettingPairing(false);
                      }
                    }}
                  />
                ) : (
                  <PairingState qr={data.whatsapp.qr} status={data.whatsapp.status} />
                )}
              </div>

              <div className="rise-in delay-2 space-y-5">
                <section className="rounded-[2rem] border border-border bg-[hsl(var(--secondary)/0.48)] p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Readiness</p>
                      <h2 className="mt-3 font-serif text-2xl tracking-[-0.025em]">Everything in its place</h2>
                    </div>
                    <HeartPulse className="text-[hsl(var(--chart-2))]" size={25} aria-hidden="true" />
                  </div>
                  <div className="mt-6 space-y-1">
                    <ReadinessRow
                      label="WhatsApp connection"
                      value={whatsappConnected ? 'Ready' : 'Action needed'}
                      ready={whatsappConnected}
                      testId="readiness-whatsapp"
                    />
                    <ReadinessRow
                      label="AI service"
                      value={data.ai.configured ? data.ai.provider || 'Configured' : 'Not configured'}
                      ready={data.ai.configured}
                      testId="readiness-ai"
                    />
                    <ReadinessRow
                      label="Paystack"
                      value={data.paystack.configured ? 'Configured' : 'Not configured'}
                      ready={data.paystack.configured}
                      testId="readiness-paystack"
                    />
                  </div>
                </section>

                <section className="rounded-[2rem] border border-border bg-card p-6 sm:p-7">
                  <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
                    <ScanLine size={17} aria-hidden="true" />
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Operator note</p>
                  </div>
                  <p className="mt-4 font-serif text-xl leading-8 text-foreground">
                    “Clear health information, with guidance on when to seek care.”
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Afeeyah AI health line</span>
                    <button
                      type="button"
                      data-testid="button-refresh-status"
                      onClick={() => void refetch()}
                      disabled={isFetching}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <RefreshCw className={isFetching ? 'animate-spin' : ''} size={13} aria-hidden="true" />
                      {isFetching ? 'Checking' : 'Check now'}
                    </button>
                  </div>
                </section>
              </div>
            </section>

            <footer className="mt-8 flex flex-col gap-3 border-t border-border/80 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck size={14} aria-hidden="true" />
                Built for calm, reliable care operations.
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">Afeeyah AI / v1.0</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" data-testid="brand-afeeyah">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-[hsl(var(--sidebar-primary))] text-sidebar-primary-foreground shadow-[0_8px_20px_hsl(14_72%_68%_/_0.18)]">
        <HeartPulse size={21} strokeWidth={2.2} aria-hidden="true" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-sidebar bg-[hsl(var(--chart-2))]" />
      </div>
      <div>
        <div className={`font-serif text-xl leading-none tracking-[-0.03em] ${compact ? 'text-foreground' : 'text-sidebar-foreground'}`}>Afeeyah AI</div>
        <div className={`mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.2em] ${compact ? 'text-muted-foreground' : 'text-sidebar-foreground/45'}`}>health support</div>
      </div>
    </div>
  );
}

function StatusPill({ tone }: { tone: 'connected' | 'pairing' | 'waiting' | 'error' }) {
  const content = {
    connected: { label: 'Connected', icon: <Wifi size={14} aria-hidden="true" />, classes: 'bg-[hsl(var(--chart-2)/0.13)] text-[hsl(var(--chart-2))]' },
    pairing: { label: 'Pairing needed', icon: <QrCode size={14} aria-hidden="true" />, classes: 'bg-[hsl(var(--accent)/0.15)] text-[hsl(14_55%_42%)]' },
    waiting: { label: 'Waiting for code', icon: <Clock3 size={14} aria-hidden="true" />, classes: 'bg-muted text-muted-foreground' },
    error: { label: 'Connection issue', icon: <WifiOff size={14} aria-hidden="true" />, classes: 'bg-[hsl(var(--destructive)/0.12)] text-destructive' },
  }[tone];
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold ${content.classes}`} data-testid="status-connection">
      {content.icon}
      {content.label}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
  testId,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: 'teal' | 'coral' | 'plum' | 'sand' | 'gold';
  testId: string;
}) {
  const toneClasses = {
    teal: 'bg-[hsl(var(--secondary)/0.72)] text-[hsl(var(--chart-2))]',
    coral: 'bg-[hsl(var(--accent)/0.16)] text-[hsl(14_55%_42%)]',
    plum: 'bg-[hsl(var(--primary)/0.1)] text-primary',
    sand: 'bg-muted text-muted-foreground',
    gold: 'bg-[hsl(42_68%_64%_/_0.22)] text-[hsl(34_55%_33%)]',
  }[tone];
  return (
    <article className="rise-in rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_12px_35px_hsl(247_29%_24%_/_0.045)] transition-transform hover:-translate-y-0.5" data-testid={`card-${testId}`}>
      <div className="flex items-start justify-between gap-4">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClasses}`}>{icon}</span>
        <ArrowUpRight size={15} className="text-muted-foreground/60" aria-hidden="true" />
      </div>
      <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className="mt-2 truncate font-serif text-2xl tracking-[-0.025em]" data-testid={testId}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function ReadinessRow({ label, value, ready, testId }: { label: string; value: string; ready: boolean; testId: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-[hsl(var(--border)/0.65)] py-3.5 first:border-t-0">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ready ? 'bg-[hsl(var(--chart-2)/0.15)] text-[hsl(var(--chart-2))]' : 'bg-[hsl(var(--accent)/0.18)] text-[hsl(14_55%_42%)]'}`}>
        {ready ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <CircleDashed size={14} aria-hidden="true" />}
      </span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <span className={`text-xs font-medium ${ready ? 'text-[hsl(var(--chart-2))]' : 'text-muted-foreground'}`} data-testid={testId}>{value}</span>
    </div>
  );
}

function PairingState({ qr, status }: { qr: string | null; status: string }) {
  return (
    <div className="grid gap-7 px-6 py-7 sm:grid-cols-[minmax(190px,0.82fr)_1fr] sm:px-8 sm:py-8">
      <div className="flex justify-center sm:justify-start">
        <div className="qr-frame relative flex aspect-square w-full max-w-[236px] items-center justify-center overflow-hidden rounded-[1.5rem] border border-[hsl(var(--border)/0.8)] p-5 shadow-inner">
          <div className="absolute left-3 top-3 h-7 w-7 rounded-tl-lg border-l-2 border-t-2 border-[hsl(var(--primary))]" />
          <div className="absolute bottom-3 right-3 h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-[hsl(var(--primary))]" />
          {qr ? (
            <QrCodeImage value={qr} />
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-2 text-center text-muted-foreground">
              <CircleDashed size={34} className="animate-spin" aria-hidden="true" />
              <span className="font-mono text-[9px] uppercase tracking-widest">Waiting for code</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Three quiet steps</p>
        <div className="mt-4 space-y-4">
          <Instruction number="01" title="Open WhatsApp" detail="On the phone that will carry the Afeeyah AI number, open WhatsApp." />
          <Instruction number="02" title="Go to Linked devices" detail="Choose Settings, then Linked devices, then Link a device." />
          <Instruction number="03" title="Scan this code" detail="Point the phone camera at the live code. Keep this window open." />
        </div>
        <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <Clock3 size={14} aria-hidden="true" />
          <span data-testid="text-whatsapp-status">Service state: {status.replace('_', ' ')}</span>
        </div>
      </div>
    </div>
  );
}

function QrCodeImage({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSrc(null);
    setFailed(false);
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 480,
      color: { dark: '#29213f', light: '#fffdf8' },
    })
      .then((dataUrl) => {
        if (active) setSrc(dataUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [value]);

  if (failed) {
    return (
      <div className="relative z-10 flex max-w-[190px] flex-col items-center gap-2 text-center text-muted-foreground">
        <AlertCircle size={28} aria-hidden="true" />
        <span className="font-mono text-[9px] uppercase tracking-widest">QR unavailable — refresh</span>
      </div>
    );
  }

  if (!src) {
    return <CircleDashed size={34} className="relative z-10 animate-spin text-muted-foreground" aria-label="Generating QR code" />;
  }

  return (
    <img
      src={src}
      alt="Current WhatsApp pairing QR code"
      className="relative z-10 aspect-square w-full rounded-lg object-contain"
      data-testid="img-whatsapp-qr"
    />
  );
}

function Instruction({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="flex gap-3">
      <span className="pt-0.5 font-mono text-[10px] font-bold text-[hsl(var(--accent))]">{number}</span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ConnectedState({
  isResetting,
  error,
  onReset,
}: {
  isResetting: boolean;
  error: string | null;
  onReset: () => Promise<void>;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center sm:px-8">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[hsl(var(--secondary))] text-[hsl(var(--chart-2))]">
        <div className="absolute inset-[-10px] rounded-[2.5rem] border border-[hsl(var(--chart-2)/0.18)]" />
        <CheckCircle2 size={43} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3 className="mt-8 font-serif text-3xl tracking-[-0.03em]">The line is listening.</h3>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        WhatsApp is paired and Afeeyah AI is ready to respond to new health questions.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--secondary)/0.7)] px-3 py-2 text-xs font-bold text-[hsl(var(--chart-2))]">
          <Wifi size={13} aria-hidden="true" /> Listening
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-bold text-muted-foreground">
          <ShieldCheck size={13} aria-hidden="true" /> Secure session
        </span>
      </div>
      <button
        type="button"
        data-testid="button-reset-pairing"
        onClick={() => void onReset()}
        disabled={isResetting}
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw className={isResetting ? 'animate-spin' : ''} size={13} aria-hidden="true" />
        {isResetting ? 'Resetting pairing' : 'Reset pairing'}
      </button>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function CapabilityCard({
  number,
  title,
  detail,
  upcoming = false,
}: {
  number: string;
  title: string;
  detail: string;
  upcoming?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-[hsl(var(--accent))]">{number}</span>
        {upcoming ? <span className="rounded-full bg-muted px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Coming soon</span> : null}
      </div>
      <h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  );
}

function LoadingScreen() {
  return (
    <div className="materna-shell min-h-[100dvh] p-5 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3 border-b border-border py-5">
          <div className="h-10 w-10 animate-pulse rounded-[14px] bg-muted" />
          <div className="space-y-2"><div className="h-4 w-24 animate-pulse rounded bg-muted" /><div className="h-2 w-20 animate-pulse rounded bg-muted" /></div>
        </div>
        <div className="mt-12 space-y-6">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="h-14 w-80 animate-pulse rounded-xl bg-muted" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-[1.5rem] bg-muted" />)}
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="h-[410px] animate-pulse rounded-[2rem] bg-muted" />
            <div className="h-[410px] animate-pulse rounded-[2rem] bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
