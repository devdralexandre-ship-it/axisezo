import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, UserPlus, Clock } from 'lucide-react';
import { Patient, getTaskSlaState } from '@/data/types';

interface Props {
  open: boolean;
  onClose: () => void;
  conciergeName: string;
  patients: Patient[];
  /** ISO timestamp of the last time the user dismissed the briefing */
  lastSeenAt: string | null;
  onOpenPatient: (patientId: string) => void;
}

export function ConciergeLoginBriefing({
  open, onClose, conciergeName, patients, lastSeenAt, onOpenPatient,
}: Props) {
  const since = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;

  const newPatients = useMemo(() => {
    return patients
      .filter((p) => p.concierge === conciergeName && p.stage !== 'lost')
      .filter((p) => {
        const created = p.createdAt ? new Date(p.createdAt).getTime() : 0;
        return created > since;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [patients, conciergeName, since]);

  const breachedTasks = useMemo(() => {
    const out: { patient: Patient; taskTitle: string; tone: 'breached' | 'escalated' }[] = [];
    patients.forEach((p) => {
      if (p.stage === 'lost') return;
      const isMine = p.concierge === conciergeName;
      p.tasks.forEach((t) => {
        if (t.completed) return;
        const state = getTaskSlaState(t);
        if (state !== 'breached' && state !== 'escalated') return;
        // Show if responsible is this concierge OR task escalated and patient is in her portfolio
        const responsibleMatch = t.responsible === conciergeName;
        if (!responsibleMatch && !isMine) return;
        out.push({ patient: p, taskTitle: t.title, tone: state });
      });
    });
    return out;
  }, [patients, conciergeName]);

  const totalCount = newPatients.length + breachedTasks.length;

  if (!conciergeName) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-pipeline-amber" />
            Bom dia, {conciergeName} — você tem {totalCount} {totalCount === 1 ? 'item' : 'itens'} para revisar
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4">
            <section>
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Novos pacientes na sua carteira</h3>
                <Badge variant="secondary">{newPatients.length}</Badge>
              </div>
              {newPatients.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum paciente novo desde seu último acesso.</p>
              ) : (
                <ul className="space-y-1">
                  {newPatients.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => { onOpenPatient(p.id); onClose(); }}
                        className="w-full text-left p-2 rounded-md hover:bg-accent border border-border/40"
                      >
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.procedure} · {p.surgeon}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold">Tolerâncias estouradas</h3>
                <Badge variant="destructive">{breachedTasks.length}</Badge>
              </div>
              {breachedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma ação com tolerância vencida.</p>
              ) : (
                <ul className="space-y-1">
                  {breachedTasks.map(({ patient, taskTitle, tone }, i) => (
                    <li key={`${patient.id}-${i}`}>
                      <button
                        onClick={() => { onOpenPatient(patient.id); onClose(); }}
                        className="w-full text-left p-2 rounded-md hover:bg-accent border border-border/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{patient.name}</span>
                          <Badge variant={tone === 'escalated' ? 'destructive' : 'secondary'} className="shrink-0">
                            {tone === 'escalated' ? 'Escalada' : 'Vencida'}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{taskTitle}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={onClose}>Entendi, ir para o Kanban</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Controller hook: decides when to show the briefing based on a per-user
 * localStorage "last seen" timestamp and the presence of any actionable item.
 */
export function useConciergeBriefing(
  userId: string | undefined,
  conciergeName: string | null,
  patients: Patient[],
) {
  const [open, setOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const storageKey = userId ? `concierge-briefing-seen:${userId}` : null;

  // Load lastSeen once we have the user id
  useEffect(() => {
    if (!storageKey) return;
    setLastSeenAt(localStorage.getItem(storageKey));
  }, [storageKey]);

  // Auto-open: once per day per user, if there is anything actionable
  useEffect(() => {
    if (!userId || !conciergeName || !storageKey) return;
    if (!patients || patients.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const autoFlag = `${storageKey}:autoopen:${today}`;
    if (localStorage.getItem(autoFlag)) return;

    const since = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
    const hasNew = patients.some(
      (p) => p.concierge === conciergeName && p.stage !== 'lost' && new Date(p.createdAt).getTime() > since,
    );
    const hasBreached = patients.some((p) => {
      if (p.stage === 'lost') return false;
      const isMine = p.concierge === conciergeName;
      return p.tasks.some((t) => {
        if (t.completed) return false;
        const state = getTaskSlaState(t);
        if (state !== 'breached' && state !== 'escalated') return false;
        return t.responsible === conciergeName || isMine;
      });
    });

    if (hasNew || hasBreached) {
      setOpen(true);
      localStorage.setItem(autoFlag, '1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conciergeName, patients.length, lastSeenAt]);

  const close = () => {
    setOpen(false);
    if (storageKey) {
      const now = new Date().toISOString();
      localStorage.setItem(storageKey, now);
      setLastSeenAt(now);
    }
  };

  return { open, lastSeenAt, close, openManually: () => setOpen(true) };
}
