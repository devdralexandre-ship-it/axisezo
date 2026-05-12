// Public endpoint to fetch signature verification metadata by id.
// No auth required. Only exposes non-sensitive metadata (no clinical data).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id || !UUID_RE.test(id)) {
    return new Response(JSON.stringify({ error: "ID inválido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await admin
    .from("signature_verifications")
    .select("id, signer_name, signer_crm, signer_specialty, patient_name_snapshot, document_title, document_type, signed_at, pdf_sha256, subject_cn, valid_to, revoked_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: "Erro ao consultar" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!data) {
    return new Response(JSON.stringify({ found: false }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ found: true, ...data }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
