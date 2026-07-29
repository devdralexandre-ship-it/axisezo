import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePatients } from '@/hooks/usePatients';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { useUserRole } from '@/hooks/useUserRole';
import { Patient, PIPELINE_STAGES, PipelineStage, STAGE_LABELS, LOSS_REASONS, LOSS_REASON_LABELS, LossReason, getTaskSlaState } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

type PresetRange = '7d' | '30d' | '90d' | 'month' | 'all' | 'custom';

function toIso(d: Date) { return d.toISOString().split('T')[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toIso(d); }
function startOfMonthIso() { const d = new Date(); return toIso(new Date(d.getFullYear(), d.getMonth(), 1)); }

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--pipeline-green))', 'hsl(var(--pipeline-amber))', 'hsl(var(--destructive))', '#8b5cf6', '#06b6d4', '#f97316', '#eab308'];

function patientValue(p: Patient) {
  return (p.medicalFees ?? 0) + (p.anesthesiaFees ?? 0) + (p.hospitalBudget ?? 0) + (p.materialsCost ?? 0);
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Relatorios() {
  useRealtimePatients();
  const { data: patients = [], isLoading } = usePatients();
  const { canSeeFinancials } = useUserRole();

  const [preset, setPreset] = useState<PresetRange>('30d');
  const [from, setFrom] = useState<string>(daysAgo(30));
  const [to, setTo] = useState<string>(toIso(new Date()));
  const [conciergeFilter, setConciergeFilter] = useState('all');
  const [surgeonFilter, setSurgeonFilter] = useState('all');

  const applyPreset = (p: PresetRange) => {
    setPreset(p);
    if (p === '7d') { setFrom(daysAgo(7)); setTo(toIso(new Date())); }
    else if (p === '30d') { setFrom(daysAgo(30)); setTo(toIso(new Date())); }
    else if (p === '90d') { setFrom(daysAgo(90)); setTo(toIso(new Date())); }
    else if (p === 'month') { setFrom(startOfMonthIso()); setTo(toIso(new Date())); }
    else if (p === 'all') { setFrom(''); setTo(''); }
  };

  const surgeons = useMemo(() => [...new Set(patients.map(p => p.surgeon).filter(Boolean))].sort(), [patients]);
  const concierges = useMemo(() => [...new Set(patients.map(p => p.concierge).filter(Boolean))].sort(), [patients]);

  // Filter by indication date + role filters
  const inRange = useMemo(() => patients.filter((p) => {
    if (conciergeFilter !== 'all' && p.concierge !== conciergeFilter) return false;
    if (surgeonFilter !== 'all' && p.surgeon !== surgeonFilter) return false;
    if (from || to) {
      const ref = p.indicationDate || p.createdAt;
      if (!ref) return false;
      if (from && ref < from) return false;
      if (to && ref > to) return false;
    }
    return true;
  }), [patients, conciergeFilter, surgeonFilter, from, to]);

  // KPIs
  const active = inRange.filter(p => p.stage !== 'lost');
  const completed = inRange.filter(p => p.stage === 'surgery_completed').length;
  const lost = inRange.filter(p => p.stage === 'lost').length;
  const conversion = (completed + lost) > 0 ? Math.round((completed / (completed + lost)) * 100) : 0;
  const totalValue = active.reduce((s, p) => s + patientValue(p), 0);
  const avgTicket = active.length > 0 ? totalValue / active.length : 0;
  const projectedRevenue = inRange
    .filter(p => p.stage === 'surgery_scheduled' || p.stage === 'preop_preparation')
    .reduce((s, p) => s + patientValue(p), 0);

  // SLA: particular patients must have a budget document attached within 24h of creation.
  const particulares = useMemo(
    () => inRange.filter(p => (p.billingType || '').toLowerCase().includes('particular')),
    [inRange],
  );
  const [budgetTimes, setBudgetTimes] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = particulares.map(p => p.id);
    if (ids.length === 0) { setBudgetTimes({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('patient_documents')
        .select('patient_id, created_at')
        .eq('type', 'budget')
        .in('patient_id', ids)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      const map: Record<string, string> = {};
      (data ?? []).forEach((d: any) => {
        if (!map[d.patient_id]) map[d.patient_id] = d.created_at;
      });
      setBudgetTimes(map);
    })();
    return () => { cancelled = true; };
  }, [particulares]);

  const nowMs = Date.now();
  const budgetSla = particulares.map((p) => {
    const created = p.createdAt ? new Date(p.createdAt).getTime() : null;
    const first = budgetTimes[p.id] ? new Date(budgetTimes[p.id]).getTime() : null;
    const deadlineMs = created != null ? created + 24 * 3600 * 1000 : null;
    let status: 'on_time' | 'late' | 'pending_ok' | 'pending_breached';
    if (first != null && created != null) {
      status = (first - created) <= 24 * 3600 * 1000 ? 'on_time' : 'late';
    } else if (deadlineMs != null && nowMs <= deadlineMs) {
      status = 'pending_ok';
    } else {
      status = 'pending_breached';
    }
    return { patient: p, first, status };
  });
  const particularesTotal = budgetSla.length;
  const particularesOnTime = budgetSla.filter(b => b.status === 'on_time').length;
  const particularesPendingOk = budgetSla.filter(b => b.status === 'pending_ok').length;
  const particularesBreached = budgetSla.filter(b => b.status === 'late' || b.status === 'pending_breached').length;
  const particularesResolved = budgetSla.filter(b => b.status === 'on_time' || b.status === 'late').length;
  const particularesSlaPct = particularesResolved > 0
    ? Math.round((particularesOnTime / particularesResolved) * 100)
    : 100;


  // Funnel by stage
  const funnelData = PIPELINE_STAGES.filter(s => s !== 'lost').map((s) => {
    const list = inRange.filter(p => p.stage === s);
    return {
      stage: STAGE_LABELS[s],
      count: list.length,
      value: list.reduce((sum, p) => sum + patientValue(p), 0),
    };
  });

  // Loss reasons
  const lossData = LOSS_REASONS.map((r) => ({
    name: LOSS_REASON_LABELS[r],
    value: inRange.filter(p => p.stage === 'lost' && p.lossReason === r).length,
  })).filter(d => d.value > 0);
  const lostWithoutReason = inRange.filter(p => p.stage === 'lost' && !p.lossReason).length;
  if (lostWithoutReason > 0) lossData.push({ name: 'Sem motivo', value: lostWithoutReason });

  // Productivity by concierge
  const productivityData = concierges.map((c) => {
    const list = inRange.filter(p => p.concierge === c);
    const tasks = list.flatMap(p => p.tasks);
    const completedTasks = tasks.filter(t => t.completed).length;
    const openTasks = tasks.filter(t => !t.completed);
    const breached = openTasks.filter(t => {
      const st = getTaskSlaState(t);
      return st === 'breached' || st === 'escalated';
    }).length;
    const slaHealth = openTasks.length > 0 ? Math.round(((openTasks.length - breached) / openTasks.length) * 100) : 100;
    return {
      name: c,
      pacientes: list.length,
      concluidas: completedTasks,
      sla: slaHealth,
    };
  }).filter(d => d.pacientes > 0);

  // Financial by payer
  const payerMap: Record<string, number> = {};
  active.forEach((p) => {
    const key = p.payer || 'Sem convênio';
    payerMap[key] = (payerMap[key] || 0) + patientValue(p);
  });
  const payerData = Object.entries(payerMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" />Kanban</Link></Button>
          <h1 className="text-lg font-semibold">Relatórios</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {(['7d', '30d', '90d', 'month', 'all'] as PresetRange[]).map((p) => (
              <Button
                key={p}
                variant={preset === p ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => applyPreset(p)}
              >
                {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : p === 'month' ? 'Mês atual' : 'Tudo'}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }} className="h-8 rounded border border-input bg-background px-2 text-xs" />
            <span>até</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }} className="h-8 rounded border border-input bg-background px-2 text-xs" />
          </div>
          <Select value={conciergeFilter} onValueChange={setConciergeFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Concierge" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos concierges</SelectItem>
              {concierges.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={surgeonFilter} onValueChange={setSurgeonFilter}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Cirurgião" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos cirurgiões</SelectItem>
              {surgeons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="px-4 md:px-6 py-4 space-y-6 max-w-6xl mx-auto">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">No pipeline</div>
                <div className="text-2xl font-bold">{active.length}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{lost} perdidos · {completed} realizadas</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Conversão</div>
                <div className="text-2xl font-bold">{conversion}%</div>
                <div className="text-[10px] text-muted-foreground mt-1">realizadas / (realizadas + perdidos)</div>
              </Card>
              {canSeeFinancials && (
                <>
                  <Card className="p-3">
                    <div className="text-xs text-muted-foreground">Ticket médio</div>
                    <div className="text-2xl font-bold">{fmtCurrency(avgTicket)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Total: {fmtCurrency(totalValue)}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-xs text-muted-foreground">Receita projetada</div>
                    <div className="text-2xl font-bold">{fmtCurrency(projectedRevenue)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Agendadas + aptas</div>
                  </Card>
                </>
              )}
            </div>

            {/* Funnel */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Funil de conversão por estágio</h3>
                <Button variant="ghost" size="sm" onClick={() => downloadCsv('funil.csv',
                  [['Estágio', 'Pacientes', 'Valor'], ...funnelData.map(d => [d.stage, d.count, d.value])])}>
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
              <div className="h-[360px]">
                <ResponsiveContainer>
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" fontSize={11} />
                    <YAxis dataKey="stage" type="category" fontSize={11} width={140} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => typeof v === 'number' ? v : v} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Pacientes" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Loss reasons + Payers */}
            <div className="grid md:grid-cols-2 gap-3">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Perdidos por motivo</h3>
                  <Button variant="ghost" size="sm" onClick={() => downloadCsv('perdidos.csv',
                    [['Motivo', 'Qtde'], ...lossData.map(d => [d.name, d.value])])}>
                    <Download className="h-3.5 w-3.5" />CSV
                  </Button>
                </div>
                {lossData.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">Sem perdidos no período</div>
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={lossData} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => `${e.value}`}>
                          {lossData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              {canSeeFinancials && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Receita por convênio</h3>
                    <Button variant="ghost" size="sm" onClick={() => downloadCsv('convenios.csv',
                      [['Convênio', 'Valor'], ...payerData.map(d => [d.name, d.value])])}>
                      <Download className="h-3.5 w-3.5" />CSV
                    </Button>
                  </div>
                  {payerData.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">Sem dados</div>
                  ) : (
                    <div className="h-[260px]">
                      <ResponsiveContainer>
                        <BarChart data={payerData} margin={{ bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" fontSize={10} angle={-25} textAnchor="end" height={60} />
                          <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(Number(v))} />
                          <Bar dataKey="value" fill="hsl(var(--pipeline-green))" name="Valor" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Productivity */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Produtividade por concierge</h3>
                <Button variant="ghost" size="sm" onClick={() => downloadCsv('produtividade.csv',
                  [['Concierge', 'Pacientes', 'Ações concluídas', 'SLA %'], ...productivityData.map(d => [d.name, d.pacientes, d.concluidas, d.sla])])}>
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
              {productivityData.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Sem dados</div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer>
                    <BarChart data={productivityData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="pacientes" fill="hsl(var(--primary))" name="Pacientes" />
                      <Bar dataKey="concluidas" fill="hsl(var(--pipeline-green))" name="Ações concluídas" />
                      <Bar dataKey="sla" fill="hsl(var(--pipeline-amber))" name="SLA (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
