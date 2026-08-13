import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllTaskTypes, useUpsertTaskType, useDeleteTaskType, TaskType } from '@/hooks/useTaskTypes';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';

interface DraftRow {
  id?: string;
  name: string;
  maxHours: number;
  defaultToleranceHours: number;
  active: boolean;
  position: number;
}

const emptyRow = (position: number): DraftRow => ({
  name: '', maxHours: 48, defaultToleranceHours: 24, active: true, position,
});

export default function AdminTaskTypes() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data: types = [], isLoading } = useAllTaskTypes();
  const upsert = useUpsertTaskType();
  const remove = useDeleteTaskType();
  const [edits, setEdits] = useState<Record<string, DraftRow>>({});
  const [newRow, setNewRow] = useState<DraftRow | null>(null);

  const rowOf = (t: TaskType): DraftRow => edits[t.id] ?? { ...t };
  const patch = (t: TaskType, p: Partial<DraftRow>) =>
    setEdits((prev) => ({ ...prev, [t.id]: { ...rowOf(t), ...p } }));

  if (roleLoading) return <div className="p-6"><Skeleton className="h-24 w-full" /></div>;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        <Button asChild variant="outline"><Link to="/">Voltar</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 py-3 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" />Kanban</Link></Button>
        <h1 className="text-lg font-semibold">Tipos de ação e prazos</h1>
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => setNewRow(emptyRow((types.at(-1)?.position ?? 0) + 10))}
          disabled={!!newRow}
        >
          <Plus className="h-4 w-4" />Novo tipo
        </Button>
      </header>

      <main className="px-4 md:px-6 py-4 space-y-3 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">
          O prazo máximo define até quando a ação pode ser agendada, contado a partir da criação.
          Prazos acima do limite só são aceitos com justificativa e ficam marcados como "prazo estendido".
        </p>

        {isLoading && <Skeleton className="h-32 w-full" />}

        {newRow && (
          <Card className="p-3 border-primary/40">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div className="col-span-2 space-y-1">
                <Label className="text-[11px]">Nome</Label>
                <Input value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Prazo máx. (h)</Label>
                <Input type="number" min={1} value={newRow.maxHours} onChange={(e) => setNewRow({ ...newRow, maxHours: Math.max(1, parseInt(e.target.value) || 1) })} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Tolerância (h)</Label>
                <Input type="number" min={0} value={newRow.defaultToleranceHours} onChange={(e) => setNewRow({ ...newRow, defaultToleranceHours: Math.max(0, parseInt(e.target.value) || 0) })} className="h-8" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => setNewRow(null)}>Cancelar</Button>
              <Button
                size="sm"
                disabled={!newRow.name.trim() || upsert.isPending}
                onClick={() => upsert.mutate(newRow, { onSuccess: () => setNewRow(null) })}
              >
                <Save className="h-4 w-4" />Salvar
              </Button>
            </div>
          </Card>
        )}

        {types.map((t) => {
          const row = rowOf(t);
          const dirty = JSON.stringify(row) !== JSON.stringify({ ...t });
          return (
            <Card key={t.id} className="p-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[11px]">Nome</Label>
                  <Input value={row.name} onChange={(e) => patch(t, { name: e.target.value })} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Prazo máx. (h)</Label>
                  <Input type="number" min={1} value={row.maxHours} onChange={(e) => patch(t, { maxHours: Math.max(1, parseInt(e.target.value) || 1) })} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Tolerância (h)</Label>
                  <Input type="number" min={0} value={row.defaultToleranceHours} onChange={(e) => patch(t, { defaultToleranceHours: Math.max(0, parseInt(e.target.value) || 0) })} className="h-8" />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-2">
                  <Switch checked={row.active} onCheckedChange={(v) => patch(t, { active: v })} />
                  <span className="text-xs text-muted-foreground">{row.active ? 'Ativo' : 'Inativo'}</span>
                </div>
                {dirty && <Badge variant="outline" className="text-[10px]">Alterações não salvas</Badge>}
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { if (confirm(`Remover o tipo "${t.name}"?`)) remove.mutate(t.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={!dirty || !row.name.trim() || upsert.isPending}
                    onClick={() => upsert.mutate({ ...row, id: t.id }, {
                      onSuccess: () => setEdits((prev) => { const n = { ...prev }; delete n[t.id]; return n; }),
                    })}
                  >
                    <Save className="h-4 w-4" />Salvar
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
