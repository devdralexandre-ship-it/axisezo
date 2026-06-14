import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { usePatients, useDeletePatient } from '@/hooks/usePatients';
import { useUserRole } from '@/hooks/useUserRole';
import { Patient, STAGE_LABELS } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Users, ShieldAlert, Trash2, EyeOff } from 'lucide-react';

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
  highConfidence: boolean; // also share phone or email
}

export default function AdminDuplicates() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { data: patients = [], isLoading } = usePatients();
  const deletePatient = useDeletePatient();
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{ keep: Patient; remove: Patient[] } | null>(null);

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
    // Sort: high confidence first, then alphabetical
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
                Agrupados por nome normalizado (sem acentos, maiúsculas e espaços extras desconsiderados).
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

        {groups.map((g) => (
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIgnored((prev) => new Set(prev).add(g.key))}
              >
                <EyeOff className="h-4 w-4" />Ignorar
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {g.patients.map((p) => {
                const others = g.patients.filter((x) => x.id !== p.id);
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-md border border-border bg-muted/20 text-xs"
                  >
                    <div className="col-span-3">
                      <p className="font-semibold text-foreground truncate">{p.procedure}</p>
                      <p className="text-muted-foreground">{STAGE_LABELS[p.stage]}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Cirurgião</p>
                      <p className="text-foreground truncate">{p.surgeon || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Telefone</p>
                      <p className="text-foreground truncate">{p.phone || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">E-mail</p>
                      <p className="text-foreground truncate">{p.email || '—'}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-muted-foreground">Criado</p>
                      <p className="text-foreground">{formatDate(p.createdAt)}</p>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setPendingDelete({ keep: p, remove: others })}
                        disabled={deletePatient.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Manter este, excluir {others.length === 1 ? 'o outro' : `os ${others.length}`}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
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
    </div>
  );
}
