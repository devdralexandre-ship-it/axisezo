// Revoke own A1 certificate: removes file from storage, deletes row, logs revocation.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://axiscrm.app",
  "https://www.axiscrm.app",
  "https://axisezo.lovable.app",
];
function corsHeadersFor(origin: string | null) {
  const allowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin)
  ) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autenticado" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { error: "Não autenticado" });

    const { data: profile } = await admin
      .from("profiles").select("display_name, surgeon_name").eq("user_id", user.id).maybeSingle();
    const name = profile?.display_name ?? profile?.surgeon_name ?? user.email ?? "Usuário";

    await admin.storage.from("signing-certificates").remove([`${user.id}/cert.pfx`]);
    const { error: delErr } = await admin
      .from("signing_certificates").delete().eq("user_id", user.id);
    if (delErr) throw delErr;

    await admin.rpc("insert_signature_audit", {
      _signer_user_id: user.id,
      _signer_name: name,
      _acted_by_user_id: user.id,
      _acted_by_name: name,
      _patient_id: null, _patient_name: null,
      _document_id: null, _document_title: null, _document_type: null,
      _result: "revoked",
      _error: null,
      _ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      _ua: req.headers.get("user-agent") ?? null,
    });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
