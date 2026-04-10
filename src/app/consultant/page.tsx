"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  Bot,
  TrendingUp,
  AlertTriangle,
  MessageCircle,
  MapPin,
  Sparkles,
  Loader2,
  Send,
  Ticket,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Navigation,
  Zap,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import type { RoutingResponse, BranchCard } from '@/app/api/q-route/route';

// ─── Types ────────────────────────────────────────────────────────────────────

type WaitPrediction = {
  etaMinutes: number;
  confidence: number;
  ticketNumber: string;
  smsNotice: string;
  source: 'claude' | 'heuristic';
};

type ChatLanguage = 'English' | 'Zulu' | 'Xhosa' | 'Afrikaans';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
};

type AlertRecord = {
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  timestamp: string;
};

// ─── Static data ──────────────────────────────────────────────────────────────

const SERVICES = [
  { id: 'passport', label: 'Passport Renewal', prefix: 'P' },
  { id: 'smart-id', label: 'Smart ID Application', prefix: 'I' },
  { id: 'birth-cert', label: 'Birth Certificate', prefix: 'B' },
  { id: 'marriage', label: 'Marriage Registration', prefix: 'M' },
  { id: 'permit', label: 'Permit / Immigration', prefix: 'R' },
  { id: 'sassa', label: 'SASSA Grant', prefix: 'S' },
  { id: 'drivers', label: "Driver's Licence", prefix: 'D' },
];

const FORECAST_VS_HISTORY = [
  { day: 'Mon', forecast: 262, historical: 238 },
  { day: 'Tue', forecast: 226, historical: 211 },
  { day: 'Wed', forecast: 204, historical: 199 },
  { day: 'Thu', forecast: 236, historical: 221 },
  { day: 'Fri', forecast: 289, historical: 255 },
  { day: 'Sat', forecast: 118, historical: 104 },
  { day: 'Sun', forecast: 64, historical: 58 },
];

const HEATMAP_HOURS = ['08:00', '10:00', '12:00', '14:00', '16:00'];
const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const FORECAST_HEATMAP = [
  [66, 58, 52, 61, 78, 39, 24],
  [84, 73, 67, 79, 91, 48, 31],
  [91, 84, 72, 88, 96, 56, 35],
  [74, 70, 63, 75, 89, 51, 29],
  [49, 46, 42, 55, 68, 38, 20],
];

const STAFFING_GUIDANCE = [
  { slot: '08:00–10:00', delta: '+1', reason: 'Morning ID demand spike' },
  { slot: '10:00–12:00', delta: '+2', reason: 'Peak passport intake' },
  { slot: '12:00–14:00', delta: '−1', reason: 'Lower mid-day arrival rate' },
  { slot: '14:00–16:00', delta: '+1', reason: 'Late-day permit arrivals' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function heatColor(value: number): string {
  if (value >= 86) return '#ef4444';
  if (value >= 70) return '#f97316';
  if (value >= 50) return '#eab308';
  if (value >= 35) return '#84cc16';
  return '#22c55e';
}

function congestionColor(level: string): string {
  switch (level) {
    case 'LOW': return '#22c55e';
    case 'MODERATE': return '#eab308';
    case 'HIGH': return '#f97316';
    case 'FULL': return '#ef4444';
    default: return '#64748b';
  }
}

function now(): string {
  return new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function baseVolumes() {
  return ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'].map((slot, i) => {
    const expected = 40 + i * 3 + (i % 2 === 0 ? 5 : -2);
    const stdDev = expected * 0.14;
    const actual = Math.max(10, Math.round(expected + (Math.random() * 2 - 1) * 7));
    return { slot, expected, actual, threshold: Math.round(expected + stdDev * 3) };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 85 ? '#22c55e' : value >= 70 ? '#eab308' : '#f97316';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">Confidence</span>
        <span className="font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function CongestionBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-green-500/15 text-green-400 border-green-500/30',
    MODERATE: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    FULL: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colors[level] ?? 'bg-muted/20 text-muted-foreground border-white/10'}`}>
      {level}
    </span>
  );
}

function QueueBar({ current, capacity }: { current: number; capacity: number }) {
  const pct = Math.min(100, Math.round((current / capacity) * 100));
  const color = pct >= 90 ? '#ef4444' : pct >= 65 ? '#f97316' : pct >= 40 ? '#eab308' : '#22c55e';
  return (
    <div className="space-y-0.5">
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{current}/{capacity} in queue</p>
    </div>
  );
}

function BranchResultCard({ branch, rank }: { branch: BranchCard; rank: 'best' | 'alt' }) {
  const isBest = rank === 'best';
  return (
    <div className={`rounded-2xl border p-4 space-y-3 transition-all ${
      isBest
        ? 'border-primary/50 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]'
        : 'border-white/10 bg-background'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          {isBest && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Q Recommends
            </p>
          )}
          <p className="font-bold text-sm leading-snug">{branch.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />{branch.address}, {branch.city}
          </p>
        </div>
        <CongestionBadge level={branch.congestionLevel} />
      </div>

      <QueueBar current={branch.currentQueue} capacity={branch.capacity} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span>~<span className={`font-bold ${isBest ? 'text-primary' : ''}`}>{branch.estimatedWaitMinutes} min</span> wait</span>
        </div>
        <p className="text-[10px] text-muted-foreground">{branch.department}</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-[#202c33] rounded-2xl px-4 py-3 flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function QDashboard() {
  const { toast } = useToast();
  const router = useRouter();

  // — Feature 1
  const [serviceId, setServiceId] = useState(SERVICES[0].id);
  const [queuePosition, setQueuePosition] = useState('18');
  const [staffCount, setStaffCount] = useState('4');
  const [queueVelocity, setQueueVelocity] = useState('7');
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<WaitPrediction | null>(null);

  // — Feature 2
  const [routingText, setRoutingText] = useState("I need to renew my passport, it expired last year");
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingResult, setRoutingResult] = useState<RoutingResponse | null>(null);

  // — Feature 3
  const [volumeData, setVolumeData] = useState(baseVolumes);
  const [liveAlert, setLiveAlert] = useState<AlertRecord | null>(null);

  // — Feature 4
  const [language, setLanguage] = useState<ChatLanguage>('English');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Hi, I\'m Q. Ask me for a ticket, wait time, or branch in English, Zulu, Xhosa, or Afrikaans.',
      timestamp: now(),
    },
  ]);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Live anomaly chart ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setVolumeData((prev) => {
        const last = prev[prev.length - 1];
        const nextExpected = Math.max(35, Math.round(last.expected + (Math.random() * 2 - 1) * 4));
        const nextStd = nextExpected * 0.14;
        const nextActual = Math.max(12, Math.round(nextExpected + (Math.random() * 2 - 1) * 8));
        const [h, m] = last.slot.split(':').map(Number);
        const nextM = (m + 30) % 60;
        const nextH = nextM === 0 ? h + 1 : h;
        const nextSlot = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
        return [
          ...prev.slice(1),
          { slot: nextSlot, expected: nextExpected, actual: nextActual, threshold: Math.round(nextExpected + nextStd * 3) },
        ];
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const anomalies = useMemo(() => volumeData.filter((p) => p.actual > p.threshold), [volumeData]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handlePredictWait() {
    setPredicting(true);
    setPrediction(null);
    try {
      const selectedService = SERVICES.find((s) => s.id === serviceId);
      const res = await fetch('/api/smart-wait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: selectedService?.label,
          queuePosition: Number(queuePosition),
          staffCount: Number(staffCount),
          queueVelocity: Number(queueVelocity),
        }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = (await res.json()) as WaitPrediction;
      setPrediction(data);
    } catch {
      toast({ variant: 'destructive', title: 'Prediction failed', description: 'Retry in a few seconds.' });
    } finally {
      setPredicting(false);
    }
  }

  async function handleRoute() {
    if (!routingText.trim()) return;
    setRoutingLoading(true);
    setRoutingResult(null);
    try {
      const res = await fetch('/api/q-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceQuery: routingText }),
      });
      if (!res.ok) throw new Error('Route request failed');
      const data = (await res.json()) as RoutingResponse;
      setRoutingResult(data);
    } catch {
      toast({ variant: 'destructive', title: 'Routing failed', description: 'Unable to reach branch data.' });
    } finally {
      setRoutingLoading(false);
    }
  }

  function simulateAnomaly() {
    setVolumeData((prev) => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, actual: last.threshold + 24 }];
    });
    const alert: AlertRecord = {
      severity: 'HIGH',
      description: 'Queue volume exceeded 3-sigma threshold — sudden walk-in surge detected.',
      timestamp: now(),
    };
    setLiveAlert(alert);
    toast({ variant: 'destructive', title: '🚨 Anomaly detected', description: alert.description });
  }

  async function handleSendChat() {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: trimmed, timestamp: now() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/q-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, language, history: chatHistory }),
      });
      const data = await res.json() as { reply: string; source?: string };
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        text: data.reply || 'Sorry, I could not respond right now.',
        timestamp: now(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: data.reply },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Connection issue. Please try again.', timestamp: now() },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background">

      {/* ── Header ── */}
      <section className="border-b border-white/5 bg-card/60">
        <div className="container mx-auto px-4 md:px-8 py-10 space-y-4">
          <div>
            <Link
              href="/"
              aria-label="Back to Home"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-background text-muted-foreground hover:text-foreground hover:border-white/30 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
            <Bot className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Q — AI Intelligence Suite</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-headline font-extrabold leading-tight">
            Five live intelligence features.
            <span className="text-primary"> One queue interface.</span>
          </h1>
          <p className="text-muted-foreground max-w-3xl text-lg">
            Smart ETA prediction, branch routing, 3-sigma anomaly detection, multilingual WhatsApp assistant, and demand
            forecasting — all powered by Claude AI, built for South African public services.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 md:px-8 py-10 space-y-8">

        {/* ── Row 1: Feature 1 + Feature 2 ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

          {/* Feature 1 — Smart Wait Time Prediction */}
          <Card className="p-6 border-primary/25 bg-card space-y-6">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Feature 1</p>
                <h2 className="text-xl font-headline font-extrabold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary shrink-0" />
                  Smart Wait Time Prediction
                </h2>
                <p className="text-xs text-muted-foreground">
                  Q accounts for time of day, day of week, staff count, and queue velocity.
                </p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary shrink-0">Claude AI</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Service</p>
                <select
                  className="h-11 w-full rounded-xl border border-white/10 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                >
                  {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Queue Position</p>
                <Input
                  type="number"
                  min={1}
                  value={queuePosition}
                  onChange={(e) => setQueuePosition(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Staff on Shift</p>
                <Input
                  type="number"
                  min={1}
                  value={staffCount}
                  onChange={(e) => setStaffCount(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Queue Velocity (pph)</p>
                <Input
                  type="number"
                  min={1}
                  value={queueVelocity}
                  onChange={(e) => setQueueVelocity(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <Button className="w-full h-12 rounded-xl font-bold text-sm" onClick={handlePredictWait} disabled={predicting}>
              {predicting
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Calculating with Claude...</>
                : <><Sparkles className="h-4 w-4 mr-2" />Predict Exact ETA</>}
            </Button>

            {prediction && (
              <div className="rounded-2xl border border-primary/30 bg-primary/8 p-5 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-5xl font-headline font-extrabold text-primary tabular-nums">
                    {prediction.etaMinutes}
                    <span className="text-2xl ml-1 font-bold">min</span>
                  </p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold text-sm tracking-wider">{prediction.ticketNumber}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] w-fit ${prediction.source === 'claude' ? 'border-primary/30 text-primary' : 'border-white/20 text-muted-foreground'}`}
                    >
                      {prediction.source === 'claude' ? '✦ Claude AI' : 'Heuristic fallback'}
                    </Badge>
                  </div>
                </div>
                <ConfidenceBar value={prediction.confidence} />
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-background px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  <p className="text-xs text-muted-foreground">{prediction.smsNotice}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Feature 2 — Intelligent Queue Routing */}
          <Card className="p-6 border-white/10 bg-card space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Feature 2</p>
                <h2 className="text-xl font-headline font-extrabold flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary shrink-0" />
                  Intelligent Branch Routing
                </h2>
                <p className="text-xs text-muted-foreground">
                  Tell Q what service you need. Q shows you which branch has the shortest queue right now — and which ones to avoid.
                </p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary shrink-0">Live Queue Data</Badge>
            </div>

            {/* Quick-select chips */}
            <div className="flex flex-wrap gap-2">
              {['Passport', 'Smart ID', 'Birth Certificate', "Driver's Licence", 'SASSA Grant'].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setRoutingText(`I need a ${chip}`)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                    routingText.toLowerCase().includes(chip.toLowerCase())
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-white/10 bg-background text-muted-foreground hover:border-white/30 hover:text-foreground'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={routingText}
                onChange={(e) => setRoutingText(e.target.value)}
                placeholder="e.g. I need to renew my passport"
                className="h-11 rounded-xl flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') handleRoute(); }}
              />
              <Button
                className="h-11 px-5 rounded-xl font-bold text-sm shrink-0"
                onClick={handleRoute}
                disabled={routingLoading || !routingText.trim()}
              >
                {routingLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Navigation className="h-4 w-4" />}
              </Button>
            </div>

            {routingLoading && (
              <div className="rounded-xl border border-white/10 bg-background px-4 py-3 flex items-center gap-3">
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                <p className="text-xs text-muted-foreground">Q is checking live queue volumes across all branches…</p>
              </div>
            )}

            {routingResult && !routingLoading && (
              <div className="space-y-4 overflow-y-auto max-h-[520px] pr-1">

                {/* Q reasoning bubble */}
                <div className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-extrabold text-primary-foreground shrink-0">Q</div>
                  <p className="text-xs leading-relaxed text-foreground/80">{routingResult.reasoning}</p>
                </div>

                {/* ✅ GO HERE */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-green-400">Go Here</p>
                  </div>
                  <div className="rounded-2xl border border-green-500/40 bg-green-500/8 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm leading-snug">{routingResult.recommendedBranch.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />{routingResult.recommendedBranch.address}, {routingResult.recommendedBranch.city}
                        </p>
                      </div>
                      <CongestionBadge level={routingResult.recommendedBranch.congestionLevel} />
                    </div>
                    <QueueBar current={routingResult.recommendedBranch.currentQueue} capacity={routingResult.recommendedBranch.capacity} />
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-green-400 font-bold">
                        <Clock className="h-3.5 w-3.5" />~{routingResult.recommendedBranch.estimatedWaitMinutes} min wait
                      </span>
                      <span className="text-[10px] text-muted-foreground">{routingResult.recommendedBranch.department}</span>
                    </div>
                  </div>
                </div>

                {/* ⚡ ALSO AVAILABLE */}
                {routingResult.alternativeBranches.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-yellow-400" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Also Available</p>
                    </div>
                    {routingResult.alternativeBranches.map((b) => (
                      <div key={b.id} className="rounded-2xl border border-yellow-500/25 bg-yellow-500/5 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm">{b.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{b.city}
                            </p>
                          </div>
                          <CongestionBadge level={b.congestionLevel} />
                        </div>
                        <QueueBar current={b.currentQueue} capacity={b.capacity} />
                        <p className="text-xs text-muted-foreground">~<span className="font-bold text-foreground">{b.estimatedWaitMinutes} min</span> wait</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 🚫 AVOID */}
                {routingResult.busyBranches && routingResult.busyBranches.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Currently Overloaded — Avoid</p>
                    </div>
                    {routingResult.busyBranches.map((b) => (
                      <div key={b.id} className="rounded-2xl border border-red-500/25 bg-red-500/5 p-3 space-y-2 opacity-80">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm line-through decoration-red-500/50">{b.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{b.city}
                            </p>
                          </div>
                          <CongestionBadge level={b.congestionLevel} />
                        </div>
                        <QueueBar current={b.currentQueue} capacity={b.capacity} />
                        <p className="text-xs text-red-400/80">~{b.estimatedWaitMinutes} min wait · High volume</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                  <span>Detected: <span className="font-medium text-foreground">{routingResult.serviceMatched}</span></span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${routingResult.source === 'claude' ? 'border-primary/30 text-primary' : 'border-white/20 text-muted-foreground'}`}
                  >
                    {routingResult.source === 'claude' ? '✦ Claude AI' : 'Heuristic'}
                  </Badge>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ── Row 2: Feature 3 + Feature 4 ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

          {/* Feature 3 — Anomaly Detection */}
          <Card className="p-6 border-white/10 bg-card space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Feature 3</p>
                <h2 className="text-xl font-headline font-extrabold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary shrink-0" />
                  Anomaly Detection
                </h2>
                <p className="text-xs text-muted-foreground">
                  Live actual vs expected with 3-sigma threshold. Red dots = anomaly events.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 text-primary shrink-0"
                onClick={simulateAnomaly}
              >
                Simulate Alert
              </Button>
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="slot" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={32} />
                  <Tooltip
                    contentStyle={{ background: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                  />
                  <Line type="monotone" dataKey="expected" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Expected" />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#e2e8f0"
                    strokeWidth={2}
                    name="Actual"
                    dot={(props: Record<string, unknown>) => {
                      const isAnomaly = (props.payload as { actual: number; threshold: number }).actual > (props.payload as { actual: number; threshold: number }).threshold;
                      return (
                        <circle
                          cx={props.cx as number}
                          cy={props.cy as number}
                          r={isAnomaly ? 5 : 3}
                          fill={isAnomaly ? '#ef4444' : '#e2e8f0'}
                          stroke={isAnomaly ? '#ef4444' : 'none'}
                          strokeWidth={isAnomaly ? 2 : 0}
                        />
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="threshold" stroke="#ef4444" strokeDasharray="5 4" strokeWidth={1.5} dot={false} name="3σ Threshold" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart legend */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full bg-primary inline-block" /> Expected</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full bg-slate-200 inline-block" /> Actual</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full bg-red-500 inline-block opacity-70 border-dashed" /> 3σ Threshold</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Anomaly</span>
              <span className="ml-auto font-medium">{anomalies.length} active</span>
            </div>

            {liveAlert && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="font-bold text-sm text-red-400">{liveAlert.severity} ALERT</p>
                  <span className="ml-auto text-xs text-muted-foreground">{liveAlert.timestamp}</span>
                </div>
                <p className="text-sm pl-6">{liveAlert.description}</p>
              </div>
            )}
          </Card>

          {/* Feature 4 — Q Assistant (WhatsApp Mockup) */}
          <Card className="p-0 border-white/10 bg-card overflow-hidden flex flex-col">
            {/* WhatsApp header */}
            <div className="px-5 py-4 border-b border-white/10 bg-[#202c33] flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center font-bold text-sm text-primary-foreground shrink-0">Q</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">Q Assistant</p>
                <p className="text-xs text-green-400">Online · South African Government Services</p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary text-[10px] shrink-0">Feature 4</Badge>
            </div>

            {/* Chat window */}
            <div className="flex-1 bg-[#0b141a] px-4 py-4 space-y-3 overflow-y-auto" style={{ minHeight: 280, maxHeight: 340 }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] space-y-1">
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user' ? 'bg-[#005c4b] text-[#ecfdf5]' : 'bg-[#202c33] text-[#e2e8f0]'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <p className={`text-[10px] text-muted-foreground ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              ))}
              {chatLoading && <TypingIndicator />}
              <div ref={chatEndRef} />
            </div>

            {/* Language + input */}
            <div className="px-4 py-4 border-t border-white/10 space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {(['English', 'Zulu', 'Xhosa', 'Afrikaans'] as ChatLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`h-8 rounded-lg text-xs font-bold transition-colors ${
                      language === lang
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background border border-white/10 text-muted-foreground hover:border-white/25'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type to Q..."
                  className="h-11 rounded-xl flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendChat(); } }}
                  disabled={chatLoading}
                />
                <Button
                  size="icon"
                  className="h-11 w-11 rounded-xl shrink-0"
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">
                Powered by Claude AI · No app needed
              </p>
            </div>
          </Card>
        </div>

        {/* ── Feature 5 — Demand Forecasting ── */}
        <Card className="p-6 border-white/10 bg-card space-y-6">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Feature 5</p>
              <h2 className="text-xl font-headline font-extrabold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                Demand Forecasting
              </h2>
              <p className="text-xs text-muted-foreground">
                Predicted queue volume by day and hour, 7-day forecast vs historical, and staffing guidance.
              </p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary shrink-0">ML Model</Badge>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

            {/* Heatmap */}
            <div className="space-y-4">
              <p className="text-sm font-bold">Queue Volume Heatmap — Predicted (% of capacity)</p>
              <div className="grid grid-cols-8 gap-1.5">
                <div />
                {HEATMAP_DAYS.map((day) => (
                  <div key={day} className="text-[10px] text-center font-bold text-muted-foreground">{day}</div>
                ))}
                {HEATMAP_HOURS.map((hour, hIdx) => (
                  <React.Fragment key={hour}>
                    <div className="text-[10px] font-bold text-muted-foreground flex items-center">{hour}</div>
                    {FORECAST_HEATMAP[hIdx].map((value, dIdx) => (
                      <div
                        key={`${hour}-${dIdx}`}
                        className="h-10 rounded-lg flex items-center justify-center text-[10px] font-bold text-black"
                        style={{ backgroundColor: heatColor(value) }}
                        title={`${HEATMAP_DAYS[dIdx]} ${hour}: ${value}%`}
                      >
                        {value}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
              {/* Heatmap legend */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                <span className="font-bold text-foreground">Volume:</span>
                {[
                  { color: '#22c55e', label: 'Low (<35%)' },
                  { color: '#84cc16', label: '35–50%' },
                  { color: '#eab308', label: '50–70%' },
                  { color: '#f97316', label: '70–86%' },
                  { color: '#ef4444', label: 'Critical (86%+)' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Bar chart + staffing */}
            <div className="space-y-5">
              <div>
                <p className="text-sm font-bold mb-3">7-Day Forecast vs Historical Average</p>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={FORECAST_VS_HISTORY} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={35} />
                      <Tooltip
                        contentStyle={{ background: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                        labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                        formatter={(value) => value === 'historical' ? 'Historical avg' : 'Q Forecast'}
                      />
                      <Bar dataKey="historical" fill="#475569" radius={[4, 4, 0, 0]} name="historical" />
                      <Bar dataKey="forecast" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="forecast" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold">AI Staffing Recommendations</p>
                {STAFFING_GUIDANCE.map((item) => (
                  <div key={item.slot} className="rounded-xl border border-white/10 bg-background px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm">{item.slot}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.reason}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 font-bold ${
                        item.delta.startsWith('+')
                          ? 'border-green-500/40 text-green-400'
                          : 'border-orange-500/40 text-orange-400'
                      }`}
                    >
                      {item.delta} staff
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
