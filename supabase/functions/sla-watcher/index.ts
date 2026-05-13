import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const nowIso = new Date().toISOString();

    // 1) Mark breaches
    const { data: breached, error: breachErr } = await supabase
      .from('tasks')
      .update({ sla_breached_at: nowIso })
      .is('sla_breached_at', null)
      .eq('completed', false)
      .lt('sla_due_at', nowIso)
      .select('id');
    if (breachErr) throw breachErr;

    // 2) Find escalation candidates (breached, not escalated, not completed, breach old enough)
    const { data: candidates, error: candErr } = await supabase
      .from('tasks')
      .select('id, patient_id, title, responsible, sla_breached_at, escalate_after_hours')
      .is('escalated_at', null)
      .eq('completed', false)
      .not('sla_breached_at', 'is', null);
    if (candErr) throw candErr;

    let escalatedCount = 0;
    const now = Date.now();

    for (const t of candidates ?? []) {
      const breachAt = new Date(t.sla_breached_at as string).getTime();
      const tolMs = (t.escalate_after_hours ?? 24) * 3600 * 1000;
      if (now - breachAt < tolMs) continue;

      // Resolve patient surgeon as escalation target; fallback to "admin"
      const { data: patient } = await supabase
        .from('patients')
        .select('surgeon, name')
        .eq('id', t.patient_id)
        .maybeSingle();

      const target = patient?.surgeon || 'admin';
      const reason = `SLA estourado em ${Math.round((now - breachAt) / 3600000)}h sem conclusão por ${t.responsible}`;

      const { error: updErr } = await supabase
        .from('tasks')
        .update({
          escalated_at: new Date().toISOString(),
          escalated_to: target,
          escalation_reason: reason,
        })
        .eq('id', t.id);
      if (updErr) continue;

      // Trail in contact_records
      await supabase.from('contact_records').insert({
        patient_id: t.patient_id,
        type: 'phone',
        by_whom: 'SLA Watcher',
        note: `🚨 Ação "${t.title}" escalada para ${target}. ${reason}.`,
      });

      escalatedCount++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        breached: breached?.length ?? 0,
        escalated: escalatedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
