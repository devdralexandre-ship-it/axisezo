import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { usePatients, useDeletePatient } from '@/hooks/usePatients';
import { useUserRole } from '@/hooks/useUserRole';
import { Patient, STAGE_LABELS } from '@/data/types';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Users, ShieldAlert, Trash2, EyeOff, Merge, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const normalizeName = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, ' ');

const formatDate = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? s + 'T12:00:00' : s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

interface DuplicateGroup {
  key: string;
  patients: Patient[];
  highConfidence: boolean;
}

const RELATED_TABLES = [
  { table: 'patient_documents', label: 'Documentos' },
  { table: 'patient_uploads', label: 'Anexos' },
  { table: 'tasks', label: 'Ações' },
  { table: 'contact_records', label: 'Contatos' },
  { table: 'pending_items', label: 'Pendências' },
  { table: 'preop_checklist_items', label: 'Itens do checklist pré-op' },
  { table: 'patient_sent_materials', label: 'Materiais enviados' },
] as const;

type CountMap = Record<string, number>;

function MergePreviewDialog({
  keep,
  remove,
  onClose,
  onConfirm,
  loading,
}: {
  keep: Patient;
  remove: Patient[];
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [counts, setCounts] = useState<CountMap | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoadingCounts(true);
      const removeIds = remove.map((p) => p.id);
      const results = await Promise.all(
        RELATED_TABLES.map(async ({ table }) => {
          const { count } = await supabase
            .from(table as any)
            .select('*', { count: 'exact', head: true })
            .in('patient_id', removeIds);
          return [table, count ?? 0] as const;
        }),
      );
      if (cancel) return;
      setCounts(Object.fromEntries(results));
      setLoadingCounts(false);
    }
    load();
    return () => { cancel = true; };
  }, [remove]);

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <AlertDialog open onOpenChange={(o) => !o && !loading && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Unificar pacientes duplicados</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Registro principal (mantido)</p>
                <p className="font-semibold text-foreground">{keep.name}</p>
                <p className="text-xs text-muted-foreground">
                  {keep.procedure} · {STAGE_LABELS[keep.stage]} · {keep.surgeon || 'sem cirurgião'}
                </p>
              </div>

              <div className="rounded-md border border-destructive/30 p-3 bg-destructive/5">
                <p className="text-xs text-destructive uppercase tracking-wide mb-1">
                  Serão excluídos ({remove.length})
                </p>
                <ul className="space-y-1">
                  {remove.map((p) => (
                    <li key={p.id} className="text-xs text-foreground">
                      · {p.procedure} · {STAGE_LABELS[p.stage]} · criado em {formatDate(p.createdAt)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Será reatribuído ao principal
                </p>
                {loadingCounts ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Calculando...
                  </div>
                ) : (
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {RELATED_TABLES.map(({ table, label }) => (
                      <li key={table} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`font-medium ${(counts?.[table] ?? 0) > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {counts?.[table] ?? 0}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!loadingCounts && total === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Nenhum dado vinculado aos duplicados — só os registros em si serão removidos.
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Campos do paciente principal (telefone, e-mail, valores, etc.) não serão sobrescritos.
              </p>
              <p className="text-destructive font-medium text-xs">Essa ação não pode ser desfeita.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={loading || loadingCounts}
          >
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Unificando...</> : 'Unificar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function AdminDuplicates() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { data: patients = [], isLoading } = usePatients();
  const deletePatient = useDeletePatient();
  const qc = useQueryClient();
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{ keep: Patient; remove: Patient[] } | null>(null);
  const [keepByGroup, setKeepByGroup] = useState<Record<string, string>>({});
  const [mergePreview, setMergePreview] = useState<{ keep: Patient; remove: Patient[] } | null>(null);

  const mergeMutation = useMutation({
    mutationFn: async ({ keep, remove }: { keep: string; remove: string[] }) => {
      const { error } = await supabase.rpc('merge_patients' as any, {
        _keep: keep,
        _remove: remove,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pacientes unificados com sucesso');
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['patient-documents'] });
      qc.invalidateQueries({ queryKey: ['patient-uploads'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setMergePreview(null);
    },
    onError: (e: any) => {
      toast.error(`Erro ao unificar: ${e.message ?? e}`);
    },
  });

  const groups: DuplicateGroup[] = useMemo(() => {
    const map = new Map<string, Patient[]>();
    for (const p of patients) {
      const n = normalizeName(p.name);
      if (n.length < 2) continue;
      if (!map.has(n)) map.set(n, []);
      map.get(n)!.push(p);
    }
    const out: DuplicateGroup[] = [];
    for (const [key, list] of map) {
      if (list.length < 2) continue;
      const phones = new Set(list.map((p) => (p.phone || '').replace(/\D/g, '')).filter(Boolean));
      const emails = new Set(list.map((p) => (p.email || '').trim().toLowerCase()).filter(Boolean));
      const highConfidence =
        (phones.size === 1 && list.every((p) => (p.phone || '').replace(/\D/g, ''))) ||
        (emails.size === 1 && list.every((p) => (p.email || '').trim()));
      out.push({ key, patients: list, highConfidence });
    }
    out.sort((a, b) => Number(b.highConfidence) - Number(a.highConfidence) || a.key.localeCompare(b.key));
    return out.filter((g) => !ignored.has(g.key));
  }, [patients, ignored]);

  if (roleLoading) {
    return <div className="flex items-center justify-center h-screen bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const toRemove = pendingDelete.remove;
    setPendingDelete(null);
    for (const p of toRemove) {
      try {
        await deletePatient.mutateAsync(p.id);
      } catch {
        // toast already fired
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="h-4 w-4" />Voltar</Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Pacientes duplicados
              </h1>
              <p className="text-sm text-muted-foreground">
                Agrupados por nome normalizado. Escolha um registro principal para unificar dados dos duplicados nele.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            {groups.length} grupo{groups.length === 1 ? '' : 's'}
          </Badge>
        </div>

        {isLoading && <p className="text-muted-foreground">Carregando pacientes…</p>}

        {!isLoading && groups.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma duplicata detectada. 🎉
            </CardContent>
          </Card>
        )}

        {groups.map((g) => {
          const keepId = keepByGroup[g.key];
          const keepPatient = g.patients.find((p) => p.id === keepId);
          const removePatients = keepPatient ? g.patients.filter((p) => p.id !== keepId) : [];

          return (
            <Card key={g.key}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{g.patients[0].name}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{g.patients.length} registros</Badge>
                    {g.highConfidence ? (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30 border">
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        Alta confiança (telefone/e-mail iguais)
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Apenas nome coincide</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={!keepPatient || mergeMutation.isPending}
                    onClick={() => keepPatient && setMergePreview({ keep: keepPatient, remove: removePatients })}
                    title={keepPatient ? 'Unificar duplicatas no principal' : 'Escolha o registro principal primeiro'}
                  >
                    <Merge className="h-4 w-4" />
                    Unificar no principal
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIgnored((prev) => new Set(prev).add(g.key))}
                  >
                    <EyeOff className="h-4 w-4" />Ignorar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {g.patients.map((p) => {
                  const others = g.patients.filter((x) => x.id !== p.id);
                  const isKeep = keepId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`grid grid-cols-12 gap-2 items-center p-2 rounded-md border text-xs ${
                        isKeep ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className="col-span-3 min-w-0">
                        <p className="font-semibold text-foreground truncate">{p.procedure}</p>
                        <p className="text-muted-foreground">{STAGE_LABELS[p.stage]}</p>
                      </div>
                      <div className="col-span-1 min-w-0">
                        <p className="text-muted-foreground">Cirurgião</p>
                        <p className="text-foreground truncate">{p.surgeon || '—'}</p>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <p className="text-muted-foreground">Telefone</p>
                        <p className="text-foreground truncate">{p.phone || '—'}</p>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <p className="text-muted-foreground">E-mail</p>
                        <p className="text-foreground truncate">{p.email || '—'}</p>
                      </div>
                      <div className="col-span-1 min-w-0">
                        <p className="text-muted-foreground">Criado</p>
                        <p className="text-foreground">{formatDate(p.createdAt)}</p>
                      </div>
                      <div className="col-span-3 min-w-0 flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant={isKeep ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() =>
                            setKeepByGroup((prev) => ({ ...prev, [g.key]: p.id }))
                          }
                        >
                          {isKeep ? 'Principal ✓' : 'Manter este'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete({ keep: p, remove: others })}
                          disabled={deletePatient.isPending}
                          title="Excluir duplicatas (sem unificar dados)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Manter <strong>{pendingDelete?.keep.name}</strong> ({pendingDelete?.keep.procedure} — {pendingDelete && STAGE_LABELS[pendingDelete.keep.stage]}) e excluir
                  permanentemente {pendingDelete?.remove.length} registro
                  {pendingDelete && pendingDelete.remove.length === 1 ? '' : 's'} duplicado
                  {pendingDelete && pendingDelete.remove.length === 1 ? '' : 's'}?
                </p>
                <p className="text-xs text-muted-foreground">
                  Documentos, tarefas e demais dados vinculados aos duplicados serão perdidos. Use "Unificar no principal" para preservá-los.
                </p>
                <p className="text-destructive font-medium">Essa ação não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {mergePreview && (
        <MergePreviewDialog
          keep={mergePreview.keep}
          remove={mergePreview.remove}
          loading={mergeMutation.isPending}
          onClose={() => setMergePreview(null)}
          onConfirm={() =>
            mergeMutation.mutate({
              keep: mergePreview.keep.id,
              remove: mergePreview.remove.map((p) => p.id),
            })
          }
        />
      )}
    </div>
  );
}
