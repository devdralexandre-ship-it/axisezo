// Sign a patient document PDF with the surgeon's A1 certificate.
// Hardening: Zod input, MFA AAL2 gate, delegation mode,
// pfx hash check, rate limit, audit (success+failure), notification email.
import { createClient } from "npm:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";
import { z } from "npm:zod@3.23.8";
// @ts-ignore deno npm types
import { SignPdf } from "npm:@signpdf/signpdf@3.2.4";
// @ts-ignore deno npm types
import { P12Signer } from "npm:@signpdf/signer-p12@3.2.4";
// @ts-ignore deno npm types
import { pdflibAddPlaceholder } from "npm:@signpdf/placeholder-pdf-lib@3.2.4";
// @ts-ignore deno npm types
import { PDFDocument } from "npm:pdf-lib@1.17.1";

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

const DOC_BUCKET = "patient-documents";
const CERT_BUCKET = "signing-certificates";
const RATE_LIMIT_PER_24H = 20;

const BodySchema = z.object({
  document_id: z.string().uuid(),
});

async function sha256Hex(bytes: Uint8Array) {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  let actor: { id: string; name: string; email: string | null } | null = null;
  let signer: { id: string; name: string; email: string | null } | null = null;
  let patient: { id: string; name: string } | null = null;
  let docInfo: { id: string; title: string; type: string } | null = null;

  const writeAudit = async (result: string, error?: string) => {
    if (!actor) return;
    await admin.rpc("insert_signature_audit", {
      _signer_user_id: signer?.id ?? actor.id,
      _signer_name: signer?.name ?? null,
      _acted_by_user_id: actor.id,
      _acted_by_name: actor.name,
      _patient_id: patient?.id ?? null,
      _patient_name: patient?.name ?? null,
      _document_id: docInfo?.id ?? null,
      _document_title: docInfo?.title ?? null,
      _document_type: docInfo?.type ?? null,
      _result: result,
      _error: error ?? null,
      _ip: ip,
      _ua: ua,
    });
  };

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const masterKey = Deno.env.get("PFX_MASTER_KEY");
    if (!masterKey) return json(503, { error: "PFX_MASTER_KEY não configurada" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autenticado" });

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return json(401, { error: "Não autenticado" });

    // Validate body
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(400, { error: "Parâmetros inválidos" });
    const { document_id } = parsed.data;

    // MFA gate (AAL2 required)
    const token = authHeader.replace("Bearer ", "");
    const claimsRes = await userClient.auth.getClaims(token);
    const aal = (claimsRes.data?.claims as any)?.aal ?? "aal1";
    if (aal !== "aal2") {
      // we'll still need actor context for audit later; capture minimally
      const { data: aProf } = await admin
        .from("profiles").select("display_name, surgeon_name, concierge_name")
        .eq("user_id", user.id).maybeSingle();
      actor = {
        id: user.id,
        name: aProf?.display_name ?? aProf?.surgeon_name ?? aProf?.concierge_name ?? user.email ?? "Usuário",
        email: user.email ?? null,
      };
      await writeAudit("failed", "MFA não verificado");
      return json(403, { error: "Habilite e verifique MFA antes de assinar." });
    }

    // Resolve actor
    const { data: actorProfile } = await admin
      .from("profiles").select("display_name, surgeon_name, concierge_name")
      .eq("user_id", user.id).maybeSingle();
    actor = {
      id: user.id,
      name: actorProfile?.display_name ?? actorProfile?.surgeon_name ?? actorProfile?.concierge_name ?? user.email ?? "Usuário",
      email: user.email ?? null,
    };

    // Load document
    const { data: docRow, error: docErr } = await userClient
      .from("patient_documents").select("*").eq("id", document_id).maybeSingle();
    if (docErr || !docRow) throw new Error("Documento não encontrado ou sem acesso");
    docInfo = { id: docRow.id, title: docRow.title, type: docRow.type };
    if (!docRow.pdf_path) throw new Error("Documento não tem PDF gerado");

    // Patient
    const { data: patientRow, error: pErr } = await userClient
      .from("patients").select("id, name, surgeon").eq("id", docRow.patient_id).maybeSingle();
    if (pErr || !patientRow) throw new Error("Paciente não encontrado");
    patient = { id: patientRow.id, name: patientRow.name };

    // Surgeon
    const { data: surgeonProfile } = await admin
      .from("profiles").select("user_id, surgeon_name, display_name")
      .eq("surgeon_name", patientRow.surgeon).eq("active", true).maybeSingle();
    if (!surgeonProfile?.user_id) throw new Error(`Cirurgião ${patientRow.surgeon} não está cadastrado`);

    let signerEmail: string | null = null;
    try {
      const { data: aud } = await admin.auth.admin.getUserById(surgeonProfile.user_id);
      signerEmail = aud?.user?.email ?? null;
    } catch { /* ignore */ }

    signer = {
      id: surgeonProfile.user_id,
      name: surgeonProfile.display_name ?? surgeonProfile.surgeon_name ?? patientRow.surgeon,
      email: signerEmail,
    };

    // Cert metadata + delegation mode
    const { data: metaRows, error: mErr } = await admin
      .rpc("get_signing_certificate_meta", { _signer_user_id: signer.id });
    if (mErr) throw mErr;
    const meta = (metaRows as any[])?.[0];
    if (!meta) throw new Error(`Dr(a). ${signer.name} ainda não cadastrou o certificado A1`);

    // Authorization
    const { data: rolesRows } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    const roles = new Set((rolesRows ?? []).map((r: any) => r.role));
    const isSelf = user.id === signer.id;
    const isAdmin = roles.has("admin");
    const isConciergeOfPatient = roles.has("concierge")
      && actorProfile?.concierge_name
      && (await admin.from("patients").select("concierge").eq("id", patient.id).maybeSingle()).data?.concierge === actorProfile.concierge_name;

    if (!isSelf && !isAdmin) {
      // Delegation mode rules
      if (meta.delegation_mode === "never") {
        throw new Error(`Dr(a). ${signer.name} desativou a delegação de assinatura`);
      }
      if (!isConciergeOfPatient) {
        throw new Error("Você não tem permissão para assinar com este certificado");
      }
      if (meta.delegation_mode === "per_document") {
        if (!docRow.signature_authorized_by) {
          throw new Error(`Dr(a). ${signer.name} ainda não liberou este documento para assinatura`);
        }
      }
    }

    // Rate limit (per signer)
    const { data: rcount } = await admin.rpc("count_recent_signatures", { _signer_user_id: signer.id });
    if ((rcount as number) >= RATE_LIMIT_PER_24H) {
      await writeAudit("failed", "Limite diário de assinaturas atingido");
      return json(429, { error: "Limite diário de assinaturas atingido para este certificado" });
    }

    // Get cert secret + download files
    const { data: secretRows, error: sErr } = await admin
      .rpc("get_signing_certificate_secret", { _signer_user_id: signer.id, _master_key: masterKey });
    if (sErr) throw sErr;
    const secret = (secretRows as any[])?.[0];
    if (!secret) throw new Error("Senha do certificado indisponível");

    const [{ data: pfxBlob, error: pfxErr }, { data: pdfBlob, error: pdfErr }] = await Promise.all([
      admin.storage.from(CERT_BUCKET).download(meta.pfx_path),
      admin.storage.from(DOC_BUCKET).download(docRow.pdf_path),
    ]);
    if (pfxErr || !pfxBlob) throw new Error("Não foi possível baixar o certificado");
    if (pdfErr || !pdfBlob) throw new Error("Não foi possível baixar o PDF");

    const pfxBuf = new Uint8Array(await pfxBlob.arrayBuffer());

    // Hash check
    if (meta.pfx_sha256) {
      const currentHash = await sha256Hex(pfxBuf);
      if (currentHash !== meta.pfx_sha256) {
        await writeAudit("failed", "Hash do certificado divergente");
        return json(409, { error: "Integridade do certificado comprometida — recadastre" });
      }
    }

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdflibAddPlaceholder({
      pdfDoc, reason: "Assinatura digital ICP-Brasil",
      contactInfo: signer.name, name: signer.name, location: "Brasil",
    });
    const placeheld = await pdfDoc.save();
    const p12 = new P12Signer(pfxBuf as any, { passphrase: secret.password });
    const signedPdf = await new SignPdf().sign(Buffer.from(placeheld), p12);

    const signedPath = docRow.pdf_path.replace(/\.pdf$/i, "_signed.pdf");
    const { error: upErr } = await admin.storage
      .from(DOC_BUCKET)
      .upload(signedPath, signedPdf, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;

    await admin.from("patient_documents")
      .update({ signed_pdf_path: signedPath, signed_at: new Date().toISOString(), signed_by: signer.id })
      .eq("id", docRow.id);

    await writeAudit("success");

    // Email notification when delegated
    if (!isSelf && signer.email) {
      try {
        await admin.functions.invoke("send-transactional-email", {
          body: {
            to: signer.email,
            template: "signature_used",
            data: {
              signer_name: signer.name,
              acted_by_name: actor.name,
              patient_name: patient.name,
              document_title: docInfo.title,
              signed_at: new Date().toISOString(),
              ip: ip ?? "—",
            },
          },
        });
      } catch { /* email not critical */ }
    }

    return json(200, { ok: true, signed_pdf_path: signedPath });
  } catch (e) {
    const msg = (e as Error).message;
    try { await writeAudit("failed", msg); } catch { /* noop */ }
    return json(400, { error: msg });
  }
});
