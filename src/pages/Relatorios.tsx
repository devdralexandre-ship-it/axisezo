import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePatients } from '@/hooks/usePatients';
import { useRealtimePatients } from '@/hooks/useRealtimePatients';
import { useUserRole } from '@/hooks/useUserRole';
import { Patient, PIPELINE_STAGES, STAGE_LABELS, LOSS_REASONS, LOSS_REASON_LABELS, getTaskSlaState } from '@/data/types';
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
type FinancialCut = 'all' | 'particular' | 'convenio';

function toIso(d: Date) { return d.toISOString().split('T')[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toIso(d); }
function startOfMonthIso() { const d = new Date(); return toIso(new Date(d.getFullYear(), d.getMonth(), 1)); }

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--pipeline-green))', 'hsl(var(--pipeline-amber))', 'hsl(var(--destructive))', '#8b5cf6', '#06b6d4', '#f97316', '#eab308'];

function patientValue(p: Patient) {
  return (p.medicalFees ?? 0) + (p.anesthesiaFees ?? 0) + (p.hospitalBudget ?? 0) + (p.materialsCost ?? 0);
}

function isParticular(p: Patient) {
  return (p.billingType || '').toLowerCase().includes('particular');
}
function isConvenio(p: Patient) {
  const bt = (p.billingType || '').trim();
  return !!bt && !bt.toLowerCase().includes('particular');
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

function conversionStats(list: Patient[]) {
  const realizadas = list.filter(p => p.stage === 'surgery_completed').length;
  const perdidas = list.filter(p => p.stage === 'lost').length;
  const emAndamento = list.filter(p => p.stage !== 'surgery_completed' && p.stage !== 'lost').length;
  const denom = realizadas + perdidas;
  const pct = denom > 0 ? Math.round((realizadas / denom) * 100) : 0;
  const ticketRealizadas = realizadas > 0
    ? list.filter(p => p.stage === 'surgery_completed').reduce((s, p) => s + patientValue(p), 0) / realizadas
    : 0;
  return { realizadas, perdidas, emAndamento, pct, denom, ticketRealizadas };
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
  const [financialCut, setFinancialCut] = useState<FinancialCut>('all');
  const [payerFilter, setPayerFilter] = useState('all');

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
  const payers = useMemo(
    () => [...new Set(patients.map(p => (p.payer || '').trim()).filter(Boolean))].sort(),
    [patients],
  );

  // Filter by INDICATION DATE + role/financial filters. Exclude 'surgical_potential' from all metrics.
  const inRange = useMemo(() => patients.filter((p) => {
    if (p.stage === 'surgical_potential') return false;
    if (conciergeFilter !== 'all' && p.concierge !== conciergeFilter) return false;
    if (surgeonFilter !== 'all' && p.surgeon !== surgeonFilter) return false;
    if (financialCut === 'particular' && !isParticular(p)) return false;
    if (financialCut === 'convenio' && !isConvenio(p)) return false;
    if (payerFilter !== 'all' && (p.payer || '') !== payerFilter) return false;
    if (from || to) {
      const ref = p.indicationDate || p.createdAt;
      if (!ref) return false;
      if (from && ref < from) return false;
      if (to && ref > to) return false;
    }
    return true;
  }), [patients, conciergeFilter, surgeonFilter, financialCut, payerFilter, from, to]);

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

  // === Conversão — Particulares ===
  const particularesList = useMemo(() => inRange.filter(isParticular), [inRange]);
  const partAll = conversionStats(particularesList);
  const partHonorarios = particularesList.filter(p => (p.billingType || '').toLowerCase().includes('honorários'));
  const partCustos = particularesList.filter(p => (p.billingType || '').toLowerCase().includes('custos'));
  const partHonStats = conversionStats(partHonorarios);
  const partCustosStats = conversionStats(partCustos);
  const partLossReasons = LOSS_REASONS.map((r) => ({
    name: LOSS_REASON_LABELS[r],
    value: particularesList.filter(p => p.stage === 'lost' && p.lossReason === r).length,
  })).filter(d => d.value > 0);

  // === Conversão — Convênio ===
  const convenioList = useMemo(() => inRange.filter(isConvenio), [inRange]);
  const convAll = conversionStats(convenioList);
  const convByPayerMap: Record<string, Patient[]> = {};
  convenioList.forEach(p => {
    const k = p.payer || 'Sem convênio';
    (convByPayerMap[k] || (convByPayerMap[k] = [])).push(p);
  });
  const convByPayerRows = Object.entries(convByPayerMap)
    .map(([name, list]) => ({ name, ...conversionStats(list), total: list.length }))
    .sort((a, b) => b.total - a.total);
  const convLossReasons = LOSS_REASONS.map((r) => ({
    name: LOSS_REASON_LABELS[r],
    value: convenioList.filter(p => p.stage === 'lost' && p.lossReason === r).length,
  })).filter(d => d.value > 0);

  // === SLA orçamento — Particulares (24h) — PRIMEIRO ORÇAMENTO PRELIMINAR ===
  // Considera o primeiro documento do tipo 'budget' anexado no Axis,
  // independentemente do hospital / da quantidade de hospitais desejados.
  const [budgetFirstByPatient, setBudgetFirstByPatient] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = particularesList.map(p => p.id);
    if (ids.length === 0) { setBudgetFirstByPatient({}); return; }
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
      setBudgetFirstByPatient(map);
    })();
    return () => { cancelled = true; };
  }, [particularesList]);

  const nowMs = Date.now();
  const budgetSla = particularesList.map((p) => {
    const created = p.createdAt ? new Date(p.createdAt).getTime() : null;
    const deadlineMs = created != null ? created + 24 * 3600 * 1000 : null;
    const firstIso = budgetFirstByPatient[p.id];
    const firstMs = firstIso ? new Date(firstIso).getTime() : null;
    let status: 'on_time' | 'late' | 'pending_ok' | 'pending_breached';
    if (firstMs != null && created != null) {
      status = (firstMs - created) <= 24 * 3600 * 1000 ? 'on_time' : 'late';
    } else if (deadlineMs != null && nowMs <= deadlineMs) {
      status = 'pending_ok';
    } else {
      status = 'pending_breached';
    }
    const hoursToFirst = firstMs != null && created != null ? (firstMs - created) / 3600000 : null;
    return { patient: p, first: firstMs, hoursToFirst, status };
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
  const funnelData = PIPELINE_STAGES.filter(s => s !== 'lost' && s !== 'surgical_potential').map((s) => {
    const list = inRange.filter(p => p.stage === s);
    return {
      stage: STAGE_LABELS[s],
      count: list.length,
      value: list.reduce((sum, p) => sum + patientValue(p), 0),
    };
  });

  // Loss reasons (global)
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
    return { name: c, pacientes: list.length, concluidas: completedTasks, sla: slaHealth };
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

  // === CSV exports ===
  const exportRaw = () => downloadCsv('pacientes-filtrados.csv', [
    ['Paciente', 'Estágio', 'Concierge', 'Cirurgião', 'Faturamento', 'Convênio', 'Indicação', 'Cadastro', 'Valor estimado'],
    ...inRange.map(p => [
      p.name, STAGE_LABELS[p.stage] || p.stage, p.concierge || '', p.surgeon || '',
      p.billingType || '', p.payer || '', p.indicationDate || '', p.createdAt || '', patientValue(p),
    ]),
  ]);
  const exportParticulares = () => downloadCsv('conversao-particulares.csv', [
    ['Recorte', 'Total', 'Realizadas', 'Perdidas', 'Em andamento', 'Conversão %', 'Ticket médio realizadas'],
    ['Todos particulares', particularesList.length, partAll.realizadas, partAll.perdidas, partAll.emAndamento, partAll.pct, Math.round(partAll.ticketRealizadas)],
    ['Honorários Médicos Particulares', partHonorarios.length, partHonStats.realizadas, partHonStats.perdidas, partHonStats.emAndamento, partHonStats.pct, Math.round(partHonStats.ticketRealizadas)],
    ['Custos Totais Particulares', partCustos.length, partCustosStats.realizadas, partCustosStats.perdidas, partCustosStats.emAndamento, partCustosStats.pct, Math.round(partCustosStats.ticketRealizadas)],
    [],
    ['Paciente', 'Sub-tipo', 'Estágio', 'Concierge', 'Cirurgião', 'Indicação', 'Valor'],
    ...particularesList.map(p => [p.name, p.billingType || '', STAGE_LABELS[p.stage] || p.stage, p.concierge || '', p.surgeon || '', p.indicationDate || '', patientValue(p)]),
  ]);
  const exportConvenio = () => downloadCsv('conversao-convenio.csv', [
    ['Convênio', 'Total', 'Realizadas', 'Perdidas', 'Em andamento', 'Conversão %', 'Ticket médio realizadas'],
    ['(Todos convênios)', convenioList.length, convAll.realizadas, convAll.perdidas, convAll.emAndamento, convAll.pct, Math.round(convAll.ticketRealizadas)],
    ...convByPayerRows.map(r => [r.name, r.total, r.realizadas, r.perdidas, r.emAndamento, r.pct, Math.round(r.ticketRealizadas)]),
    [],
    ['Paciente', 'Convênio', 'Estágio', 'Concierge', 'Cirurgião', 'Indicação', 'Valor'],
    ...convenioList.map(p => [p.name, p.payer || '', STAGE_LABELS[p.stage] || p.stage, p.concierge || '', p.surgeon || '', p.indicationDate || '', patientValue(p)]),
  ]);
  const exportSla = () => downloadCsv('sla-orcamento-particulares.csv', [
    ['Paciente', 'Cadastro', 'Primeiro orçamento em', 'Primeiro orçamento (h)', 'Status'],
    ...budgetSla.map(b => [
      b.patient.name,
      b.patient.createdAt,
      b.first ? new Date(b.first).toISOString() : '',
      b.hoursToFirst != null ? b.hoursToFirst.toFixed(1) : '',
      b.status === 'on_time' ? 'No prazo' : b.status === 'late' ? 'Fora do prazo' : b.status === 'pending_ok' ? 'Pendente (dentro)' : 'Pendente (estourado)',
    ]),
  ]);
  const exportFunil = () => downloadCsv('funil.csv',
    [['Estágio', 'Pacientes', 'Valor'], ...funnelData.map(d => [d.stage, d.count, d.value])]);
  const exportPerdidos = () => downloadCsv('perdidos.csv',
    [['Motivo', 'Qtde'], ...lossData.map(d => [d.name, d.value])]);
  const exportProdutividade = () => downloadCsv('produtividade.csv',
    [['Concierge', 'Pacientes', 'Ações concluídas', 'SLA %'], ...productivityData.map(d => [d.name, d.pacientes, d.concluidas, d.sla])]);
  const exportConveniosReceita = () => downloadCsv('convenios-receita.csv',
    [['Convênio', 'Valor'], ...payerData.map(d => [d.name, d.value])]);
  const exportAll = () => {
    exportRaw(); exportParticulares(); exportConvenio(); exportSla();
    exportFunil(); exportPerdidos(); exportProdutividade();
    if (canSeeFinancials) exportConveniosReceita();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 py-3">
        <div className="flex items-center gap-3 mb-2">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" />Kanban</Link></Button>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Relatórios</h1>
            <p className="text-[11px] text-muted-foreground">Como está a conversão dos pacientes em cirurgia.</p>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportAll} title="Baixa uma planilha (CSV) para cada bloco desta tela">
              <Download className="h-3.5 w-3.5" />Baixar tudo em planilha
            </Button>
          </div>
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
            <span className="font-medium text-foreground">Período de indicação:</span>
            <span>de</span>
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
          <Select value={financialCut} onValueChange={(v) => setFinancialCut(v as FinancialCut)}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Tipo de pagamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pagamentos</SelectItem>
              <SelectItem value="particular">Só particulares</SelectItem>
              <SelectItem value="convenio">Só convênio</SelectItem>
            </SelectContent>
          </Select>
          <Select value={payerFilter} onValueChange={setPayerFilter}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Convênio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos convênios</SelectItem>
              {payers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Os filtros funcionam somados — quanto mais você marca, mais específico fica o resultado. Cada bloco tem um botão para baixar só aquele bloco em planilha.
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
                <div className="text-xs text-muted-foreground">Pacientes ativos</div>
                <div className="text-2xl font-bold">{active.length}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{completed} operados · {lost} perdidos</div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">% que viraram cirurgia</div>
                <div className="text-2xl font-bold">{conversion}%</div>
                <div className="text-[10px] text-muted-foreground mt-1">De cada 100 casos fechados, quantos foram operados</div>
              </Card>
              {canSeeFinancials && (
                <>
                  <Card className="p-3">
                    <div className="text-xs text-muted-foreground">Valor médio por paciente</div>
                    <div className="text-2xl font-bold">{fmtCurrency(avgTicket)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Soma no pipeline: {fmtCurrency(totalValue)}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-xs text-muted-foreground">Receita prevista</div>
                    <div className="text-2xl font-bold">{fmtCurrency(projectedRevenue)}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Cirurgias já agendadas ou prontas</div>
                  </Card>
                </>
              )}
            </div>

            {/* Conversão — Particulares */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Pacientes particulares — quantos viraram cirurgia</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Inclui quem paga só honorários médicos e quem paga o pacote completo (custos totais).
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={exportParticulares} title="Baixar este bloco em planilha">
                  <Download className="h-3.5 w-3.5" />Planilha
                </Button>
              </div>
              {particularesList.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Nenhum paciente particular no filtro atual</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">% que viraram cirurgia</div>
                      <div className="text-2xl font-bold">{partAll.pct}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{partAll.realizadas} operados de {partAll.denom} casos fechados</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Ainda em acompanhamento</div>
                      <div className="text-2xl font-bold">{partAll.emAndamento}</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Operados</div>
                      <div className="text-2xl font-bold text-[hsl(var(--pipeline-green))]">{partAll.realizadas}</div>
                    </div>
                    {canSeeFinancials && (
                      <div className="rounded border border-border p-3">
                        <div className="text-xs text-muted-foreground">Valor médio por cirurgia</div>
                        <div className="text-2xl font-bold">{fmtCurrency(partAll.ticketRealizadas)}</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 h-[220px]">
                    <ResponsiveContainer>
                      <BarChart
                        data={[
                          { name: 'Só honorários médicos', Conversao: partHonStats.pct, Total: partHonorarios.length },
                          { name: 'Pacote completo (custos totais)', Conversao: partCustosStats.pct, Total: partCustos.length },
                        ]}
                        layout="vertical"
                        margin={{ left: 12, right: 12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" fontSize={11} />
                        <YAxis dataKey="name" type="category" fontSize={11} width={220} />
                        <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any, k: any) => k === 'Conversao' ? [`${v}%`, '% viraram cirurgia'] : [v, k]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Total" fill="hsl(var(--primary))" name="Total de pacientes" />
                        <Bar dataKey="Conversao" fill="hsl(var(--pipeline-green))" name="% viraram cirurgia" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {partLossReasons.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="text-xs font-medium mb-2">Por que perdemos esses pacientes</div>
                      <ul className="text-xs space-y-1">
                        {partLossReasons.sort((a, b) => b.value - a.value).slice(0, 5).map(r => (
                          <li key={r.name} className="flex items-center justify-between">
                            <span>{r.name}</span>
                            <span className="text-muted-foreground">{r.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Conversão — Convênio */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Pacientes de convênio — quantos viraram cirurgia</h3>
                  <p className="text-[11px] text-muted-foreground">Pacientes cujo pagamento vem por plano de saúde (não particular).</p>
                </div>
                <Button variant="ghost" size="sm" onClick={exportConvenio} title="Baixar este bloco em planilha">
                  <Download className="h-3.5 w-3.5" />Planilha
                </Button>
              </div>
              {convenioList.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Nenhum paciente de convênio no filtro atual</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">% que viraram cirurgia</div>
                      <div className="text-2xl font-bold">{convAll.pct}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{convAll.realizadas} operados de {convAll.denom} casos fechados</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Ainda em acompanhamento</div>
                      <div className="text-2xl font-bold">{convAll.emAndamento}</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Operados</div>
                      <div className="text-2xl font-bold text-[hsl(var(--pipeline-green))]">{convAll.realizadas}</div>
                    </div>
                    {canSeeFinancials && (
                      <div className="rounded border border-border p-3">
                        <div className="text-xs text-muted-foreground">Valor médio por cirurgia</div>
                        <div className="text-2xl font-bold">{fmtCurrency(convAll.ticketRealizadas)}</div>
                      </div>
                    )}
                  </div>
                  {convByPayerRows.length > 0 && (
                    <div className="mt-4 h-[260px]">
                      <ResponsiveContainer>
                        <BarChart data={convByPayerRows.slice(0, 8)} layout="vertical" margin={{ left: 12, right: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis type="number" fontSize={11} />
                          <YAxis dataKey="name" type="category" fontSize={11} width={140} />
                          <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any, k: any) => k === 'pct' ? [`${v}%`, '% viraram cirurgia'] : [v, k]} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="total" fill="hsl(var(--primary))" name="Total de pacientes" />
                          <Bar dataKey="pct" fill="hsl(var(--pipeline-green))" name="% viraram cirurgia" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {convLossReasons.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="text-xs font-medium mb-2">Por que perdemos esses pacientes</div>
                      <ul className="text-xs space-y-1">
                        {convLossReasons.sort((a, b) => b.value - a.value).slice(0, 5).map(r => (
                          <li key={r.name} className="flex items-center justify-between">
                            <span>{r.name}</span>
                            <span className="text-muted-foreground">{r.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* SLA orçamento particulares (24h) */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Orçamento enviado em até 24h — Particulares</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Conta se o primeiro orçamento (preliminar) foi anexado no Axis em menos de 24h após o cadastro. Não importa quantos hospitais foram escolhidos.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={exportSla} title="Baixar este bloco em planilha">
                  <Download className="h-3.5 w-3.5" />Planilha
                </Button>
              </div>
              {particularesTotal === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Nenhum paciente particular no período</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">% enviados no prazo</div>
                      <div className="text-2xl font-bold">{particularesSlaPct}%</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{particularesOnTime} de {particularesResolved} entregues em até 24h</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Dentro do prazo</div>
                      <div className="text-2xl font-bold text-[hsl(var(--pipeline-green))]">{particularesOnTime}</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Atrasados</div>
                      <div className="text-2xl font-bold text-destructive">{particularesBreached}</div>
                    </div>
                    <div className="rounded border border-border p-3">
                      <div className="text-xs text-muted-foreground">Ainda dentro do prazo</div>
                      <div className="text-2xl font-bold">{particularesPendingOk}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Sem orçamento, mas as 24h não venceram</div>
                    </div>
                  </div>
                  {particularesBreached > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="text-xs font-medium mb-2">Pacientes com orçamento atrasado</div>
                      <ul className="space-y-1 max-h-48 overflow-auto">
                        {budgetSla
                          .filter(b => b.status === 'late' || b.status === 'pending_breached')
                          .map(b => (
                            <li key={b.patient.id} className="flex items-center justify-between gap-2 text-xs">
                              <Link to={`/?patient=${b.patient.id}`} className="hover:underline truncate">
                                {b.patient.name}
                                {b.hoursToFirst != null && (
                                  <span className="ml-2 text-muted-foreground">— enviado em {b.hoursToFirst.toFixed(1)}h</span>
                                )}
                              </Link>
                              <Badge variant={b.status === 'late' ? 'secondary' : 'destructive'} className="text-[10px]">
                                {b.status === 'late' ? 'Enviado fora do prazo' : 'Sem orçamento'}
                              </Badge>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Funnel */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Onde estão os pacientes hoje</h3>
                  <p className="text-[11px] text-muted-foreground">Quantos pacientes existem em cada etapa do processo.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={exportFunil} title="Baixar este bloco em planilha">
                  <Download className="h-3.5 w-3.5" />Planilha
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
                  <Button variant="ghost" size="sm" onClick={exportPerdidos}>
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
                    <Button variant="ghost" size="sm" onClick={exportConveniosReceita}>
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
                <Button variant="ghost" size="sm" onClick={exportProdutividade}>
                  <Download className="h-3.5 w-3.5" />CSV
                </Button>
              </div>
              {productivityData.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Sem dados</div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer>
                    <BarChart data={productivityData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis yAxisId="count" fontSize={11} label={{ value: 'Volume', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }} />
                      <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} unit="%" fontSize={11} />
                      <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: any, name: any) => name === 'SLA (%)' ? [`${v}%`, name] : [v, name]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="count" dataKey="pacientes" fill="hsl(var(--primary))" name="Pacientes" radius={[3,3,0,0]} />
                      <Bar yAxisId="count" dataKey="concluidas" fill="hsl(var(--pipeline-green))" name="Ações concluídas" radius={[3,3,0,0]} />
                      <Bar yAxisId="pct" dataKey="sla" fill="hsl(var(--pipeline-amber))" name="SLA (%)" radius={[3,3,0,0]} />
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
