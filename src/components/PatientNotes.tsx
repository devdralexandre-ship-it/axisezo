import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Pencil, Send, X } from 'lucide-react';
import { usePatientNotes, useAddPatientNote, useUpdatePatientNote, canEditNote, PatientNote } from '@/hooks/usePatientNotes';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';

function formatStamp(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function PatientNotes({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { conciergeName, surgeonName, displayName } = useUserRole();
  const authorName = conciergeName || surgeonName || displayName || user?.email || 'Usuário';

  const { data: notes = [], isLoading } = usePatientNotes(patientId);
  const addNote = useAddPatientNote();
  const updateNote = useUpdatePatientNote();

  const [draft, setDraft] = useState('');
  const [draftForSurgeon, setDraftForSurgeon] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editForSurgeon, setEditForSurgeon] = useState(false);

  const submit = () => {
    if (!draft.trim()) return;
    addNote.mutate(
      { patientId, body: draft, forSurgeon: draftForSurgeon, authorName },
      { onSuccess: () => { setDraft(''); setDraftForSurgeon(false); } }
    );
  };

  const startEdit = (n: PatientNote) => {
    setEditingId(n.id);
    setEditBody(n.body);
    setEditForSurgeon(n.forSurgeon);
  };

  const saveEdit = (n: PatientNote) => {
    if (!editBody.trim()) return;
    updateNote.mutate(
      { id: n.id, patientId, body: editBody, forSurgeon: editForSurgeon },
      { onSuccess: () => setEditingId(null) }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Notas da concierge
        </h3>
        {notes.length > 0 && (
          <span className="text-xs text-muted-foreground">({notes.length})</span>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border p-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Recado, lembrete ou observação para a equipe…"
          rows={2}
          className="text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={draftForSurgeon}
              onCheckedChange={(v) => setDraftForSurgeon(!!v)}
            />
            Para o cirurgião
          </label>
          <Button size="sm" className="h-7 text-xs" onClick={submit} disabled={!draft.trim() || addNote.isPending}>
            <Send className="h-3 w-3 mr-1" /> Adicionar nota
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma nota registrada.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const editable = canEditNote(n, user?.id);
            const isEditing = editingId === n.id;
            return (
              <li key={n.id} className="rounded-lg bg-muted/50 p-2 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{n.authorName}</span>
                    <span className="text-xs text-muted-foreground">{formatStamp(n.createdAt)}</span>
                    {n.forSurgeon && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">Para o cirurgião</Badge>
                    )}
                    {n.editedAt && (
                      <span className="text-[10px] text-muted-foreground">editada em {formatStamp(n.editedAt)}</span>
                    )}
                  </div>
                  {editable && !isEditing && (
                    <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => startEdit(n)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} className="text-sm" />
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <Checkbox checked={editForSurgeon} onCheckedChange={(v) => setEditForSurgeon(!!v)} />
                        Para o cirurgião
                      </label>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3 mr-1" /> Cancelar
                        </Button>
                        <Button size="sm" className="h-7 text-xs" onClick={() => saveEdit(n)} disabled={updateNote.isPending}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{n.body}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
