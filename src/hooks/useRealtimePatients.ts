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
 */
export function useRealtimePatients() {
  const qc = useQueryClient();

  useEffect(() => {
    let channel = supabase.channel('kanban-realtime');

    for (const table of TABLES) {
      channel = channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => {
          qc.invalidateQueries({ queryKey: ['patients'] });
          if (table === 'patient_uploads') qc.invalidateQueries({ queryKey: ['patient-uploads'] });
          if (table === 'patient_documents') qc.invalidateQueries({ queryKey: ['patient-documents'] });
        },
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
