// Upload + register A1 (.pfx) certificate for the signed-in user.
// Encrypts the PFX password with PFX_MASTER_KEY using pgp_sym_encrypt and
// extracts subject CN + validity to display in the profile.
import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const masterKey = Deno.env.get("PFX_MASTER_KEY");
    if (!masterKey) {
      return new Response(JSON.stringify({ error: "PFX_MASTER_KEY não configurada" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const password = form.get("password") as string | null;
    if (!file || !password) {
      return new Response(JSON.stringify({ error: "Arquivo e senha obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pfxBytes = new Uint8Array(await file.arrayBuffer());

    // Validate + extract metadata via node-forge
    let subjectCn: string | null = null;
    let validFrom: string | null = null;
    let validTo: string | null = null;
    try {
      const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBytes));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag]?.[0];
      const cert = certBag?.cert;
      if (cert) {
        const cn = cert.subject.getField("CN");
        subjectCn = cn?.value ?? null;
        validFrom = cert.validity.notBefore.toISOString().slice(0, 10);
        validTo = cert.validity.notAfter.toISOString().slice(0, 10);
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: "Certificado inválido ou senha incorreta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to storage
    const path = `${user.id}/cert.pfx`;
    const { error: upErr } = await admin.storage
      .from("signing-certificates")
      .upload(path, pfxBytes, { contentType: "application/x-pkcs12", upsert: true });
    if (upErr) throw upErr;

    // Encrypt password using pgp_sym_encrypt via SQL
    const { data: encRes, error: encErr } = await admin.rpc as any;
    // Use raw SQL via PostgREST: call a small inline function through .rpc not available.
    // Instead, encrypt by inserting/updating with a SQL expression via the REST endpoint.
    // We do it through a direct SQL call using admin client's `from('rpc')` is not flexible,
    // so we use a one-off RPC defined in the migration. Fallback: execute via fetch to PostgREST.

    // Use pg-meta-style: invoke a tiny SQL via rpc 'set_signing_certificate'
    const { error: rpcErr } = await admin.rpc("set_signing_certificate", {
      _user_id: user.id,
      _pfx_path: path,
      _password: password,
      _master_key: masterKey,
      _subject_cn: subjectCn,
      _valid_from: validFrom,
      _valid_to: validTo,
    });
    if (rpcErr) throw rpcErr;

    return new Response(
      JSON.stringify({ ok: true, subject_cn: subjectCn, valid_from: validFrom, valid_to: validTo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
