import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const TABLES = [
  'patients',
  'tasks',
  'contact_records',
  'preop_checklist_items',
  'pending_items',
  'patient_uploads',
  'patient_documents',
] as const;

/**
 * Subscribes to Postgres realtime changes on all patient-related tables and
 * invalidates the React Query cache so the Kanban (and patient panel) refresh
 * automatically — for actions taken by the current user OR by any other user.
 *
 * Invalidations are DEBOUNCED (1.5s) to collapse rapid bursts of events
 * (e.g. the sla-watcher updating dozens of tasks at once) into a single
 * refetch of the heavy patients query, drastically reducing DB CPU.
 */
export function useRealtimePatients() {
  const qc = useQueryClient();

  useEffect(() => {
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      const keys = Array.from(pending);
      pending.clear();
      if (keys.includes('patients')) {
        qc.invalidateQueries({ queryKey: ['patients'] });
      }
      if (keys.includes('patient-uploads')) {
        qc.invalidateQueries({ queryKey: ['patient-uploads'] });
      }
      if (keys.includes('patient-documents')) {
        qc.invalidateQueries({ queryKey: ['patient-documents'] });
      }
    };

    const schedule = (key: string) => {
      pending.add(key);
      if (timer) return;
      timer = setTimeout(flush, 1500);
    };

    let channel = supabase.channel('kanban-realtime', { config: { private: true } });

    for (const table of TABLES) {
      channel = channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => {
          schedule('patients');
          if (table === 'patient_uploads') schedule('patient-uploads');
          if (table === 'patient_documents') schedule('patient-documents');
        },
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
