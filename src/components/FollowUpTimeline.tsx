import { ContactRecord } from '@/data/types';
import { Phone, MessageCircle, Mail, User } from 'lucide-react';

const typeIcons: Record<string, React.ElementType> = {
  phone: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  in_person: User,
};

const typeLabels: Record<string, string> = {
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  in_person: 'Presencial',
};

interface FollowUpTimelineProps {
  contacts: ContactRecord[];
}

export function FollowUpTimeline({ contacts }: FollowUpTimelineProps) {
  const sorted = [...contacts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-0">
      {sorted.map((contact, idx) => {
        const Icon = typeIcons[contact.type] || Phone;
        return (
          <div key={contact.id} className="flex gap-3 relative">
            {/* Vertical line */}
            {idx < sorted.length - 1 && (
              <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
            )}
            {/* Icon */}
            <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center z-10">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {/* Content */}
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{formatDate(contact.date)}</span>
                <span>•</span>
                <span>{typeLabels[contact.type]}</span>
                <span>•</span>
                <span>{contact.by}</span>
              </div>
              <p className="text-sm text-foreground mt-0.5">{contact.note}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
