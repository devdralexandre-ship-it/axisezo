import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, AlertTriangle, CheckCircle2, XCircle, FileText, ChevronRight } from 'lucide-react';
import { PipelineStage, STAGE_LABELS } from '@/data/types';
import { PROCEDURES, PAYERS } from '@/data/constants';
import { toast } from 'sonner';

// Status mapping from spreadsheet values to Axis stages
const STATUS_MAP: Record<string, PipelineStage> = {
  'agendada': 'surgery_scheduled',
  'cirurgia agendada': 'surgery_scheduled',
  'autorizada': 'awaiting_authorization',
  'enviado': 'awaiting_authorization',
  'judicializado': 'awaiting_authorization',
  'negociacao': 'followup_negotiation',
  'follow-up / negociacao': 'followup_negotiation',
  'follow up negociacao': 'followup_negotiation',
  'decisao pendente': 'decision_pending',
  'pendencia': 'decision_pending',
  'indicacao': 'indication',
  'orcamento enviado': 'budget_sent',
  'primeiro contato': 'first_contact',
  'preparo pre-operatorio': 'preop_preparation',
  'cirurgia autorizada': 'preop_preparation',
  'cirurgia concluida': 'surgery_completed',
  'preparacao orcamento': 'budget_preparation',
  'aguardando autorizacao': 'awaiting_authorization',
};

// Column mapping from CSV headers to internal fields
const COLUMN_MAP: Record<string, string> = {
  'carimbo de data/hora': 'entryDate',
  'data': 'entryDate',
  'nome do paciente': 'name',
  'contato': 'phone',
  'procedimento solicitado': 'procedure',
  'local de atendimento': 'indicationLocation',
  'convênios': 'payer',
  'convenios': 'payer',
  'hospital': 'desiredHospital',
  'observação': 'notes',
  'observacao': 'notes',
  'status': '_status',
};

// Ignored columns
const IGNORED_COLUMNS = ['status', 'tipo cirurgia', 'tipo cirúrgia'];

interface ParsedRow {
  raw: Record<string, string>;
  mapped: {
    name: string;
    phone: string;
    procedure: string;
    indicationLocation: string;
    payer: string;
    desiredHospital: string;
    notes: string;
    entryDate: string;
    stage: PipelineStage;
  };
  warnings: ImportWarning[];
  selected: boolean;
}

interface ImportWarning {
  type: 'unknown_procedure' | 'unknown_stage' | 'unknown_payer' | 'duplicate' | 'missing_name' | 'inconsistent_hospital';
  message: string;
}

type ImportStep = 'upload' | 'review' | 'importing' | 'done';

interface CsvImporterProps {
  open: boolean;
  onClose: () => void;
  onImport: (patients: Array<{
    name: string;
    phone: string;
    procedure: string;
    indicationLocation: string;
    payer: string;
    desiredHospital: string;
    notes: string;
    stage: PipelineStage;
    entryDate: string;
    initialTask: { title: string; dueDate: string; dueTime: string; responsible: string };
  }>, defaultSurgeon: string) => Promise<void>;
  existingPatientNames: string[];
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect separator
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === sep) { result.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  }).filter(row => Object.values(row).some(v => v.trim()));
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function mapRow(raw: Record<string, string>, existingNames: Set<string>, knownHospitals: Map<string, string>): ParsedRow {
  const mapped: ParsedRow['mapped'] = {
    name: '',
    phone: '',
    procedure: '',
    indicationLocation: '',
    payer: '',
    desiredHospital: '',
    notes: '',
    entryDate: '',
    stage: 'indication',
  };

  const warnings: ImportWarning[] = [];

  // Map columns
  for (const [header, value] of Object.entries(raw)) {
    const normalHeader = normalizeStr(header);
    const fieldKey = COLUMN_MAP[normalHeader];
    if (!fieldKey || fieldKey === '_status') continue;
    (mapped as any)[fieldKey] = value.trim();
  }

  // Map status
  const statusHeader = Object.keys(raw).find(h => normalizeStr(h) === 'status');
  if (statusHeader && raw[statusHeader]) {
    const statusVal = normalizeStr(raw[statusHeader]);
    const mappedStage = STATUS_MAP[statusVal];
    if (mappedStage) {
      mapped.stage = mappedStage;
    } else if (raw[statusHeader].trim()) {
      warnings.push({ type: 'unknown_stage', message: `Status desconhecido: "${raw[statusHeader].trim()}"` });
    }
  }

  // Check procedure — unknown procedures are imported as custom text (no warning)
  // We keep the original procedure text as-is

  // Check payer
  if (mapped.payer) {
    const payerNorm = normalizeStr(mapped.payer);
    const knownPayer = (PAYERS as readonly string[]).some(p => normalizeStr(p) === payerNorm);
    if (!knownPayer) {
      warnings.push({ type: 'unknown_payer', message: `Convênio desconhecido: "${mapped.payer}"` });
    }
  }

  // Check duplicate
  if (mapped.name && existingNames.has(normalizeStr(mapped.name))) {
    warnings.push({ type: 'duplicate', message: `Possível duplicata: "${mapped.name}" já existe no sistema` });
  }

  // Check missing name
  if (!mapped.name.trim()) {
    warnings.push({ type: 'missing_name', message: 'Nome do paciente não informado' });
  }

  // Check hospital consistency
  if (mapped.desiredHospital) {
    const hospNorm = normalizeStr(mapped.desiredHospital);
    const existing = knownHospitals.get(hospNorm);
    if (existing && existing !== mapped.desiredHospital) {
      warnings.push({ type: 'inconsistent_hospital', message: `Hospital "${mapped.desiredHospital}" pode ser variação de "${existing}"` });
    }
    if (!knownHospitals.has(hospNorm)) {
      knownHospitals.set(hospNorm, mapped.desiredHospital);
    }
  }

  return { raw, mapped, warnings, selected: warnings.filter(w => w.type === 'missing_name').length === 0 };
}

export function CsvImporter({ open, onClose, onImport, existingPatientNames }: CsvImporterProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [defaultSurgeon, setDefaultSurgeon] = useState('Dr Alexandre Ziomkowski');
  const [defaultResponsible, setDefaultResponsible] = useState('Margô');

  const existingSet = useMemo(() => new Set(existingPatientNames.map(n => normalizeStr(n))), [existingPatientNames]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rawRows = parseCSV(text);
      if (rawRows.length === 0) {
        toast.error('Arquivo CSV vazio ou formato inválido');
        return;
      }

      const knownHospitals = new Map<string, string>();
      const parsed = rawRows.map(raw => mapRow(raw, existingSet, knownHospitals));

      // Cross-check duplicates within the CSV itself
      const nameCount = new Map<string, number>();
      parsed.forEach(r => {
        const n = normalizeStr(r.mapped.name);
        if (n) nameCount.set(n, (nameCount.get(n) || 0) + 1);
      });
      parsed.forEach(r => {
        const n = normalizeStr(r.mapped.name);
        if (n && (nameCount.get(n) || 0) > 1 && !r.warnings.some(w => w.type === 'duplicate')) {
          r.warnings.push({ type: 'duplicate', message: `Nome duplicado no CSV: "${r.mapped.name}"` });
        }
      });

      setRows(parsed);
      setStep('review');
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, [existingSet]);

  const toggleRow = useCallback((index: number) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
  }, []);

  const selectAll = useCallback(() => {
    setRows(prev => prev.map(r => ({ ...r, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setRows(prev => prev.map(r => ({ ...r, selected: false })));
  }, []);

  const selectedRows = rows.filter(r => r.selected);
  const warningRows = rows.filter(r => r.warnings.length > 0);
  const cleanRows = rows.filter(r => r.warnings.length === 0);

  const handleConfirmImport = useCallback(async () => {
    const toImport = rows.filter(r => r.selected && r.mapped.name.trim());
    if (toImport.length === 0) {
      toast.error('Nenhum paciente selecionado para importação');
      return;
    }

    setImporting(true);
    setStep('importing');

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    try {
      await onImport(toImport.map(r => ({
        name: r.mapped.name,
        phone: r.mapped.phone,
        procedure: r.mapped.procedure || 'A definir',
        indicationLocation: r.mapped.indicationLocation,
        payer: r.mapped.payer,
        desiredHospital: r.mapped.desiredHospital,
        notes: r.mapped.notes,
        stage: r.mapped.stage,
        entryDate: r.mapped.entryDate,
        initialTask: {
          title: 'Confirmar status',
          dueDate: dueDateStr,
          dueTime: '10:00',
          responsible: defaultResponsible,
        },
      })), defaultSurgeon);
      setImportResult({ success: toImport.length, failed: 0 });
      setStep('done');
    } catch (err) {
      toast.error('Erro durante importação');
      setImporting(false);
      setStep('review');
    }
  }, [rows, onImport, defaultResponsible]);

  const handleClose = useCallback(() => {
    setStep('upload');
    setRows([]);
    setImporting(false);
    setImportResult({ success: 0, failed: 0 });
    onClose();
  }, [onClose]);

  const warningBadge = (type: ImportWarning['type']) => {
    const colors: Record<string, string> = {
      unknown_procedure: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      unknown_stage: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      unknown_payer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      duplicate: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      missing_name: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      inconsistent_hospital: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {step === 'upload' && 'Importar CSV'}
            {step === 'review' && 'Revisar Importação'}
            {step === 'importing' && 'Importando...'}
            {step === 'done' && 'Importação Concluída'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {/* UPLOAD STEP */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Selecione um arquivo CSV da planilha de acompanhamento cirúrgico
                </p>
                <label>
                  <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" asChild><span>Escolher Arquivo</span></Button>
                </label>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configuração padrão</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cirurgião padrão</Label>
                    <Select value={defaultSurgeon} onValueChange={setDefaultSurgeon}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dr Alexandre Ziomkowski">Dr Alexandre Ziomkowski</SelectItem>
                        <SelectItem value="Dr Evaristo Oliveira">Dr Evaristo Oliveira</SelectItem>
                        <SelectItem value="Dr João Estrela">Dr João Estrela</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Responsável padrão</Label>
                    <Select value={defaultResponsible} onValueChange={setDefaultResponsible}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Margô">Margô</SelectItem>
                        <SelectItem value="Call Center">Call Center</SelectItem>
                        <SelectItem value="Dr Alexandre Ziomkowski">Dr Alexandre Ziomkowski</SelectItem>
                        <SelectItem value="Dr Evaristo Oliveira">Dr Evaristo Oliveira</SelectItem>
                        <SelectItem value="Dr João Estrela">Dr João Estrela</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Mapeamento de colunas esperado:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Nome do Paciente → Nome</li>
                  <li>Contato → Telefone</li>
                  <li>Procedimento Solicitado → Procedimento</li>
                  <li>Local de atendimento → Origem / Indicação</li>
                  <li>Convênios → Convênio</li>
                  <li>Hospital → Hospital Desejado</li>
                  <li>Observação → Notas</li>
                </ul>
                <p className="font-semibold text-foreground mt-3">Mapeamento de status:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Indicação → Indicação</li>
                  <li>Decisão Pendente → Decisão Pendente</li>
                  <li>Negociação → Follow-Up / Negociação</li>
                  <li>Orçamento Enviado → Orçamento Enviado</li>
                  <li>Agendada → Cirurgia Agendada</li>
                  <li>Autorizada / Enviado / Judicializado → Aguardando Autorização</li>
                </ul>
              </div>
            </div>
          )}

          {/* REVIEW STEP */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold">{rows.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-muted-foreground">Limpos:</span>
                  <span className="font-semibold text-green-600">{cleanRows.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-muted-foreground">Com alertas:</span>
                  <span className="font-semibold text-amber-600">{warningRows.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Selecionados:</span>
                  <span className="font-semibold text-primary">{selectedRows.length}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>Selecionar todos</Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>Desmarcar todos</Button>
              </div>

              {/* Warning section */}
              {warningRows.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {warningRows.length} registro(s) com ambiguidade — revise antes de importar
                  </p>
                </div>
              )}

              {/* Patient list */}
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {rows.map((row, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-3 text-sm transition-colors ${
                        row.selected ? 'border-primary/30 bg-primary/5' : 'border-border opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={() => toggleRow(idx)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">
                              {row.mapped.name || <span className="italic text-muted-foreground">Sem nome</span>}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
                              {STAGE_LABELS[row.mapped.stage]} • {defaultSurgeon.replace('Dr ', '')}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {row.mapped.procedure && <p>Proc: {row.mapped.procedure}</p>}
                            {row.mapped.payer && <p>Convênio: {row.mapped.payer}</p>}
                            {row.mapped.desiredHospital && <p>Hospital: {row.mapped.desiredHospital}</p>}
                            {row.mapped.phone && <p>Tel: {row.mapped.phone}</p>}
                          </div>
                          {row.warnings.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {row.warnings.map((w, wi) => (
                                <span key={wi} className={`text-[10px] px-1.5 py-0.5 rounded-full ${warningBadge(w.type)}`}>
                                  ⚠ {w.message}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* IMPORTING STEP */}
          {step === 'importing' && (
            <div className="py-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Importando {selectedRows.length} pacientes...</p>
            </div>
          )}

          {/* DONE STEP */}
          {step === 'done' && (
            <div className="py-12 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <div>
                <p className="text-lg font-semibold text-foreground">{importResult.success} paciente(s) importado(s)</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cada paciente recebeu uma ação "Confirmar status" com vencimento em 48h
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t border-border">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); }}>Voltar</Button>
              <Button onClick={handleConfirmImport} disabled={selectedRows.length === 0}>
                Importar {selectedRows.length} paciente(s)
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
