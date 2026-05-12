// Sign an existing patient document PDF with the surgeon's A1 certificate.
// Concierges may trigger this for patients assigned to them; the surgeon owns the cert.
// Every attempt (success or failure) is recorded in signature_audit_log.
import { createClient } from "npm:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";
// @ts-ignore deno npm types
import { SignPdf } from "npm:@signpdf/signpdf@3.2.4";
// @ts-ignore deno npm types
import { P12Signer } from "npm:@signpdf/signer-p12@3.2.4";
// @ts-ignore deno npm types
import { pdflibAddPlaceholder } from "npm:@signpdf/placeholder-pdf-lib@3.2.4";
// @ts-ignore deno npm types
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOC_BUCKET = "patient-documents";
const CERT_BUCKET = "signing-certificates";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  let actor: { id: string; name: string } | null = null;
  let signer: { id: string; name: string } | null = null;
  let patient: { id: string; name: string } | null = null;
  let docInfo: { id: string; title: string; type: string } | null = null;

  const writeAudit = async (result: "success" | "failed", error?: string) => {
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

  try {
    const masterKey = Deno.env.get("PFX_MASTER_KEY");
    if (!masterKey) {
      return new Response(JSON.stringify({ error: "PFX_MASTER_KEY não configurada" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const documentId = body?.document_id as string | undefined;
    if (!documentId) {
      return new Response(JSON.stringify({ error: "document_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve actor name
    const { data: actorProfile } = await admin
      .from("profiles").select("display_name, surgeon_name, concierge_name")
      .eq("user_id", user.id).maybeSingle();
    actor = {
      id: user.id,
      name: actorProfile?.display_name ?? actorProfile?.surgeon_name ?? actorProfile?.concierge_name ?? user.email ?? "Usuário",
    };

    // Load document (RLS via user client to enforce access)
    const { data: docRow, error: docErr } = await userClient
      .from("patient_documents").select("*").eq("id", documentId).maybeSingle();
    if (docErr || !docRow) throw new Error("Documento não encontrado ou sem acesso");
    docInfo = { id: docRow.id, title: docRow.title, type: docRow.type };
    if (!docRow.pdf_path) throw new Error("Documento não tem PDF gerado");

    // Load patient and resolve surgeon
    const { data: patientRow, error: pErr } = await userClient
      .from("patients").select("id, name, surgeon").eq("id", docRow.patient_id).maybeSingle();
    if (pErr || !patientRow) throw new Error("Paciente não encontrado");
    patient = { id: patientRow.id, name: patientRow.name };

    const { data: surgeonProfile } = await admin
      .from("profiles").select("user_id, surgeon_name, display_name")
      .eq("surgeon_name", patientRow.surgeon).eq("active", true).maybeSingle();
    if (!surgeonProfile?.user_id) throw new Error(`Cirurgião ${patientRow.surgeon} não está cadastrado no sistema`);
    signer = {
      id: surgeonProfile.user_id,
      name: surgeonProfile.display_name ?? surgeonProfile.surgeon_name ?? patientRow.surgeon,
    };

    // Authorization: admin OR self OR concierge of this patient
    const { data: rolesRows } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    const roles = new Set((rolesRows ?? []).map((r: any) => r.role));
    let authorized = roles.has("admin") || user.id === signer.id;
    if (!authorized && roles.has("concierge")) {
      // can_access_patient already checked via RLS on document load; require concierge_name match
      if (actorProfile?.concierge_name) {
        const { data: pcheck } = await admin
          .from("patients").select("concierge").eq("id", patient.id).maybeSingle();
        if (pcheck?.concierge === actorProfile.concierge_name) authorized = true;
      }
    }
    if (!authorized) throw new Error("Você não tem permissão para assinar com este certificado");

    // Fetch decrypted certificate password
    const { data: secretRows, error: sErr } = await admin
      .rpc("get_signing_certificate_secret", { _signer_user_id: signer.id, _master_key: masterKey });
    if (sErr) throw sErr;
    const secret = (secretRows as any[])?.[0];
    if (!secret) throw new Error(`Dr(a). ${signer.name} ainda não cadastrou o certificado A1`);

    // Download cert + pdf
    const [{ data: pfxBlob, error: pfxErr }, { data: pdfBlob, error: pdfErr }] = await Promise.all([
      admin.storage.from(CERT_BUCKET).download(secret.pfx_path),
      admin.storage.from(DOC_BUCKET).download(docRow.pdf_path),
    ]);
    if (pfxErr || !pfxBlob) throw new Error("Não foi possível baixar o certificado");
    if (pdfErr || !pdfBlob) throw new Error("Não foi possível baixar o PDF");

    const pfxBuf = new Uint8Array(await pfxBlob.arrayBuffer());
    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());

    // Add signature placeholder using pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdflibAddPlaceholder({
      pdfDoc,
      reason: "Assinatura digital ICP-Brasil",
      contactInfo: signer.name,
      name: signer.name,
      location: "Brasil",
    });
    const placeheld = await pdfDoc.save();

    const p12 = new P12Signer(pfxBuf as any, { passphrase: secret.password });
    const signedPdf = await new SignPdf().sign(Buffer.from(placeheld), p12);

    // Upload as *_signed.pdf
    const signedPath = docRow.pdf_path.replace(/\.pdf$/i, "_signed.pdf");
    const { error: upErr } = await admin.storage
      .from(DOC_BUCKET)
      .upload(signedPath, signedPdf, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;

    await admin.from("patient_documents")
      .update({ signed_pdf_path: signedPath, signed_at: new Date().toISOString(), signed_by: signer.id })
      .eq("id", docRow.id);

    await writeAudit("success");

    return new Response(JSON.stringify({ ok: true, signed_pdf_path: signedPath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    try { await writeAudit("failed", msg); } catch (_) { /* noop */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
