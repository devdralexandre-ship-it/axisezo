import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { streamText } from 'npm:ai@5';
import { createOpenAICompatible } from 'npm:@ai-sdk/openai-compatible@1';
import { AXIS_MANUAL } from './manual.ts';

const MODEL = 'google/gemini-3.7-flash';

const SYSTEM = `Você é o assistente de onboarding do Axis — Jornada Cirúrgica, um CRM cirúrgico.
Sua única função é ensinar a USAR o aplicativo, com base no manual abaixo.

Regras:
- Responda sempre em português do Brasil, direto ao ponto. Até ~200 palavras nas
  respostas simples; pode ir a ~350 quando a pergunta envolver vários passos,
  permissões, assinatura digital ou segurança de dados.
- Use passos numerados quando a pergunta for "como faço X".
- O manual abaixo cobre todo o produto: pipeline, cadastro, anexos, documentos e
  assinatura A1, ações e prazos, pendências, biblioteca, importação CSV, relatórios,
  telas administrativas e segurança. Antes de dizer que não sabe, procure a resposta
  na seção correspondente do manual.
- Perguntas sobre segurança, privacidade, LGPD ou boas práticas: responda com base na
  seção "Segurança e privacidade dos dados" e reforce as práticas obrigatórias
  (não compartilhar senhas/MFA, não enviar dados de paciente por canais pessoais nem
  colar dados reais em ferramentas externas, avisar o admin em caso de incidente).
- Você NÃO tem acesso a dados de pacientes, agendas, valores ou relatórios reais, e
  isso é intencional. Se perguntarem algo desse tipo, ou se a pergunta trouxer dados
  de um paciente real, não repita esses dados: explique em qual tela do Axis o
  usuário encontra a informação e nunca invente dados.
- Se a resposta não estiver no manual, diga que não sabe e sugira falar com o
  administrador do Axis. Nunca invente telas, botões ou regras.
- Não fale sobre código, banco de dados, tabelas ou detalhes técnicos internos.


=== MANUAL ===
${AXIS_MANUAL}
=== FIM DO MANUAL ===`;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // --- auth: signed-in Axis users only ---
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return json({ error: 'Não autenticado.' }, 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401);

  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return json({ error: 'Assistente não configurado (chave de IA ausente).' }, 500);

  // --- input ---
  let payload: { messages?: { role: string; content: string }[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Requisição inválida.' }, 400);
  }
  const incoming = Array.isArray(payload.messages) ? payload.messages : [];
  const messages = incoming
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 4000) }));

  if (messages.length === 0) return json({ error: 'Nenhuma pergunta enviada.' }, 400);

  try {
    const gateway = createOpenAICompatible({
      name: 'lovable',
      baseURL: 'https://ai.gateway.lovable.dev/v1',
      headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    });

    const result = streamText({
      model: gateway(MODEL),
      system: SYSTEM,
      messages,
      temperature: 0.2,
    });

    return result.toTextStreamResponse({
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    const status = (err as { statusCode?: number; status?: number })?.statusCode
      ?? (err as { status?: number })?.status
      ?? 500;
    const message =
      status === 429 ? 'Muitas perguntas ao mesmo tempo. Aguarde alguns segundos e tente novamente.'
      : status === 402 ? 'Os créditos de IA do Axis acabaram. Avise o administrador para recarregar.'
      : status === 403 ? 'O uso de IA está bloqueado nesta conta. Fale com o administrador.'
      : 'Falha ao consultar o assistente. Tente novamente em instantes.';
    console.error('axis-help error', status, err);
    return json({ error: message }, status >= 400 && status < 600 ? status : 500);
  }
});
