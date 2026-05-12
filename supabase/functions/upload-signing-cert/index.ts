// Upload + register A1 (.pfx) certificate for the signed-in user.
// Encrypts the PFX password with PFX_MASTER_KEY and extracts subject CN, validity, SHA-256.
import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

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

async function sha256Hex(bytes: Uint8Array) {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const masterKey = Deno.env.get("PFX_MASTER_KEY");
    if (!masterKey) {
      return new Response(JSON.stringify({ error: "PFX_MASTER_KEY não configurada" }), {
        status: 503, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
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
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const password = form.get("password") as string | null;
    if (!file || !password) {
      return new Response(JSON.stringify({ error: "Arquivo e senha obrigatórios" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (file.size > 2 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Arquivo muito grande (máx 2MB)" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const pfxBytes = new Uint8Array(await file.arrayBuffer());

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
    } catch {
      return new Response(JSON.stringify({ error: "Certificado inválido ou senha incorreta" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sha256 = await sha256Hex(pfxBytes);
    const path = `${user.id}/cert.pfx`;

    const { error: upErr } = await admin.storage
      .from("signing-certificates")
      .upload(path, pfxBytes, { contentType: "application/x-pkcs12", upsert: true });
    if (upErr) throw upErr;

    const { error: rpcErr } = await admin.rpc("set_signing_certificate", {
      _user_id: user.id,
      _pfx_path: path,
      _password: password,
      _master_key: masterKey,
      _subject_cn: subjectCn,
      _valid_from: validFrom,
      _valid_to: validTo,
      _pfx_sha256: sha256,
    });
    if (rpcErr) throw rpcErr;

    return new Response(
      JSON.stringify({ ok: true, subject_cn: subjectCn, valid_from: validFrom, valid_to: validTo }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
