import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Notification } from '@/data/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NotificationBellProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClickNotification: (patientId: string) => void;
}

export function NotificationBell({ notifications, onMarkRead, onMarkAllRead, onClickNotification }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typeLabels: Record<string, string> = {
    task_overdue: '🔴',
    task_due_today: '🟡',
    stage_changed: '🔵',
    task_completed: '✅',
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-popover border border-border rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} className="text-xs text-primary hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notificação</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { onMarkRead(n.id); onClickNotification(n.patientId); setOpen(false); }}
                  className={`w-full text-left p-3 border-b border-border/50 hover:bg-accent transition-colors ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm">{typeLabels[n.type]}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{n.patientName} • {formatTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
