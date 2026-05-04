import { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, AlertTriangle, Clock, CircleAlert, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notification } from '@/data/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NotificationBellProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClickNotification: (patientId: string) => void;
  /** Open automatically on first login of the day. */
  autoOpenKey?: string;
}

type Bucket = 'overdue' | 'no_task' | 'today' | 'soon';

const BUCKET_META: Record<Bucket, { title: string; icon: typeof AlertTriangle; tone: string }> = {
  overdue: { title: 'Atrasadas', icon: AlertTriangle, tone: 'text-destructive' },
  today: { title: 'Vencem hoje', icon: Clock, tone: 'text-pipeline-amber' },
  no_task: { title: 'Sem próxima ação', icon: CircleAlert, tone: 'text-muted-foreground' },
  soon: { title: 'Próximas 48h', icon: Clock, tone: 'text-pipeline-green' },
};

function classifyBucket(n: Notification): Bucket {
  if (n.type === 'task_overdue' && n.message.startsWith('Paciente sem')) return 'no_task';
  if (n.type === 'task_overdue') return 'overdue';
  if (n.type === 'task_due_today') return 'today';
  return 'soon';
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
}

export function NotificationBell({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClickNotification,
  autoOpenKey,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [collapsedSoon, setCollapsedSoon] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const todayDemands = notifications.filter((n) => {
    const b = classifyBucket(n);
    return b === 'overdue' || b === 'today' || b === 'no_task';
  }).length;

  // Auto-open once per day per user
  useEffect(() => {
    if (!autoOpenKey) return;
    const today = new Date().toISOString().slice(0, 10);
    const flag = `notif-autoopen:${autoOpenKey}:${today}`;
    if (!localStorage.getItem(flag) && todayDemands > 0) {
      setOpen(true);
      localStorage.setItem(flag, '1');
    }
    // only run on mount per autoOpenKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const grouped = useMemo(() => {
    const buckets: Record<Bucket, Notification[]> = { overdue: [], today: [], no_task: [], soon: [] };
    notifications.forEach((n) => buckets[classifyBucket(n)].push(n));
    return buckets;
  }, [notifications]);

  const renderItem = (n: Notification) => (
    <button
      key={n.id}
      onClick={() => { onMarkRead(n.id); onClickNotification(n.patientId); setOpen(false); }}
      className={`w-full text-left p-3 border-b border-border/50 hover:bg-accent transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
    >
      <p className="text-sm text-foreground leading-snug">{n.message}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.patientName}</p>
    </button>
  );

  const renderBucket = (bucket: Bucket, list: Notification[], collapsible = false) => {
    if (list.length === 0) return null;
    const meta = BUCKET_META[bucket];
    const Icon = meta.icon;
    const isCollapsed = collapsible && collapsedSoon;
    return (
      <div key={bucket}>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border text-left"
          onClick={() => collapsible && setCollapsedSoon((v) => !v)}
        >
          {collapsible && (isCollapsed ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />)}
          <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{meta.title}</span>
          <span className="ml-auto text-[11px] font-semibold text-foreground">{list.length}</span>
        </button>
        {!isCollapsed && list.map(renderItem)}
      </div>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(!open)}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
            {unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground capitalize">{todayLabel()}</h4>
                <p className="text-xs text-muted-foreground">
                  {todayDemands === 0 ? 'Nenhuma demanda urgente' : `${todayDemands} demanda${todayDemands !== 1 ? 's' : ''} para hoje`}
                </p>
              </div>
              {unreadCount > 0 && (
                <button onClick={onMarkAllRead} className="text-xs text-primary hover:underline">
                  Marcar todas como lidas
                </button>
              )}
            </div>
          </div>
          <ScrollArea className="max-h-[28rem]">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Tudo em dia 🎉</p>
            ) : (
              <>
                {renderBucket('overdue', grouped.overdue)}
                {renderBucket('today', grouped.today)}
                {renderBucket('no_task', grouped.no_task)}
                {renderBucket('soon', grouped.soon, true)}
              </>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
