// Sign a patient document PDF with the surgeon's A1 certificate.
// Adds: institutional visual block + QR code + public verification record.
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
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
// @ts-ignore deno npm types
import QRCode from "npm:qrcode@1.5.4";

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
const VERIFY_BASE_URL = "https://axiscrm.app/verify-document";

const BodySchema = z.object({
  document_id: z.string().uuid(),
});

async function sha256Hex(bytes: Uint8Array) {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function patientInitials(name: string): string {
  return name.trim().split(/\s+/).map(p => p[0]?.toUpperCase() ?? "").join(". ") + ".";
}

function formatBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

interface SignatureBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number; // 0-based index; if absent, uses last page
}

// Minimum viable inline box (points). Below this, fallback to new page.
const MIN_BOX_W = 180;
const MIN_BOX_H = 70;

function truncateToWidth(text: string, font: any, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  const ell = "…";
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + ell;
    if (font.widthOfTextAtSize(candidate, size) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ell;
}

async function drawSignatureBlock(opts: {
  pdfDoc: any;
  signerName: string;
  crm: string | null;
  specialty: string | null;
  signedAt: Date;
  verificationId: string;
  signatureBox: SignatureBox | null;
}) {
  const { pdfDoc, signerName, crm, specialty, signedAt, verificationId, signatureBox } = opts;
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const verifyUrl = `${VERIFY_BASE_URL}/${verificationId}`;
  const qrPngBuf = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 240,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  const qrImage = await pdfDoc.embedPng(new Uint8Array(qrPngBuf));

  const pages = pdfDoc.getPages();

  // ----- Inline mode: use template's signature_box on existing page -----
  const useInline = signatureBox &&
    signatureBox.width >= MIN_BOX_W &&
    signatureBox.height >= MIN_BOX_H;

  if (signatureBox && !useInline) {
    console.warn(
      `[sign-pdf] signature_box muito pequeno (${signatureBox.width}x${signatureBox.height}pt; mínimo ${MIN_BOX_W}x${MIN_BOX_H}). Fallback para nova página.`,
    );
  }

  if (useInline) {
    const pageIdx = (typeof signatureBox.page === "number"
      && signatureBox.page >= 0
      && signatureBox.page < pages.length)
      ? signatureBox.page
      : pages.length - 1;
    const page = pages[pageIdx];
    const { width: pageW, height: pageH } = page.getSize();

    // Coordinates: PDF points, origin bottom-left. signatureBox.{x,y} is bottom-left of the box.
    // Clamp to page bounds defensively.
    const bx = Math.max(0, Math.min(signatureBox.x, pageW));
    const by = Math.max(0, Math.min(signatureBox.y, pageH));
    const bw = Math.max(0, Math.min(signatureBox.width, pageW - bx));
    const bh = Math.max(0, Math.min(signatureBox.height, pageH - by));

    const pad = 6;
    const innerLeft = bx + pad;
    const innerRight = bx + bw - pad;
    const innerTop = by + bh - pad;
    const innerBottom = by + pad;
    const innerW = innerRight - innerLeft;
    const innerH = innerTop - innerBottom;

    // QR sized relative to box height; capped by both dimensions
    const qrSize = Math.max(40, Math.min(innerH, Math.min(96, innerW * 0.35)));
    const qrX = innerRight - qrSize;
    const qrY = innerBottom + (innerH - qrSize) / 2;
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    // Text region (left of QR)
    const textLeft = innerLeft;
    const textRight = qrX - 8;
    const textW = Math.max(40, textRight - textLeft);

    // Responsive font sizes based on box height
    const nameSize = innerH >= 90 ? 12 : innerH >= 75 ? 11 : 10;
    const metaSize = innerH >= 90 ? 9.5 : innerH >= 75 ? 9 : 8.5;
    const lineGap = nameSize + 4;
    const metaGap = metaSize + 3;

    let y = innerTop - nameSize;
    const nameText = truncateToWidth(signerName, helvBold, nameSize, textW);
    page.drawText(nameText, {
      x: textLeft, y, size: nameSize, font: helvBold, color: rgb(0.06, 0.09, 0.16),
    });
    y -= lineGap;

    const metaParts: string[] = [];
    if (crm) metaParts.push(`CRM ${crm}`);
    if (specialty) metaParts.push(specialty);
    if (metaParts.length && y - metaSize >= innerBottom) {
      const metaText = truncateToWidth(metaParts.join("  ·  "), helv, metaSize, textW);
      page.drawText(metaText, {
        x: textLeft, y, size: metaSize, font: helv, color: rgb(0.31, 0.36, 0.44),
      });
      y -= metaGap;
    }

    if (y - metaSize >= innerBottom) {
      const tsText = truncateToWidth(
        `Assinado em ${formatBR(signedAt)} (Brasília)`,
        helv, metaSize, textW,
      );
      page.drawText(tsText, {
        x: textLeft, y, size: metaSize, font: helv, color: rgb(0.31, 0.36, 0.44),
      });
      y -= metaGap;
    }

    if (y - metaSize >= innerBottom) {
      const icpText = truncateToWidth(
        "Documento assinado digitalmente via ICP-Brasil",
        helvOblique, metaSize, textW,
      );
      page.drawText(icpText, {
        x: textLeft, y, size: metaSize, font: helvOblique, color: rgb(0.31, 0.36, 0.44),
      });
      y -= metaGap;
    }

    // Verification id (small, only if room)
    const idSize = 7;
    if (y - idSize >= innerBottom) {
      const idText = truncateToWidth(`ID: ${verificationId}`, helv, idSize, textW);
      page.drawText(idText, {
        x: textLeft, y, size: idSize, font: helv, color: rgb(0.45, 0.49, 0.56),
      });
    }
    return;
  }

  // ----- Fallback: dedicated new page (legacy behavior) -----
  const lastPage = pages[pages.length - 1];
  const { width: pageW, height: pageH } = lastPage.getSize();
  const margin = 36;
  const page = pdfDoc.addPage([pageW, pageH]);

  const left = margin;
  const right = pageW - margin;
  const top = pageH - margin;

  page.drawText("Verificação de Assinatura Digital", {
    x: left, y: top - 12, size: 11, font: helvBold, color: rgb(0.06, 0.09, 0.16),
  });
  page.drawLine({
    start: { x: left, y: top - 20 },
    end: { x: right, y: top - 20 },
    thickness: 0.6,
    color: rgb(0.78, 0.82, 0.88),
  });

  const blockTop = top - 36;
  const qrSize = 96;
  const qrX = right - qrSize;
  const qrY = blockTop - qrSize;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  page.drawText("Escaneie para validar", {
    x: qrX, y: qrY - 12, size: 7, font: helv, color: rgb(0.45, 0.49, 0.56),
  });

  const iconX = left;
  const iconY = blockTop - 18;
  page.drawRectangle({ x: iconX, y: iconY - 10, width: 16, height: 12, color: rgb(0.06, 0.09, 0.16) });
  page.drawRectangle({ x: iconX + 2, y: iconY + 2, width: 1.5, height: 8, color: rgb(0.06, 0.09, 0.16) });
  page.drawRectangle({ x: iconX + 12.5, y: iconY + 2, width: 1.5, height: 8, color: rgb(0.06, 0.09, 0.16) });
  page.drawRectangle({ x: iconX + 2, y: iconY + 9, width: 12, height: 1.5, color: rgb(0.06, 0.09, 0.16) });

  let textY = blockTop - 8;
  page.drawText(signerName, {
    x: iconX + 24, y: textY, size: 12, font: helvBold, color: rgb(0.06, 0.09, 0.16),
  });
  textY -= 16;
  const meta1: string[] = [];
  if (crm) meta1.push(`CRM ${crm}`);
  if (specialty) meta1.push(specialty);
  if (meta1.length) {
    page.drawText(meta1.join("  ·  "), {
      x: iconX + 24, y: textY, size: 9.5, font: helv, color: rgb(0.31, 0.36, 0.44),
    });
    textY -= 14;
  }

  page.drawText(`Assinado em ${formatBR(signedAt)} (Brasília)`, {
    x: iconX + 24, y: textY, size: 9, font: helv, color: rgb(0.31, 0.36, 0.44),
  });
  textY -= 13;

  page.drawText("Documento assinado digitalmente via ICP-Brasil", {
    x: iconX + 24, y: textY, size: 9, font: helvOblique, color: rgb(0.31, 0.36, 0.44),
  });

  const footerY = 48;
  page.drawLine({
    start: { x: left, y: footerY + 18 },
    end: { x: right, y: footerY + 18 },
    thickness: 0.4,
    color: rgb(0.85, 0.88, 0.92),
  });
  page.drawText("ID de verificação:", {
    x: left, y: footerY, size: 8, font: helv, color: rgb(0.45, 0.49, 0.56),
  });
  page.drawText(verificationId, {
    x: left + 86, y: footerY, size: 8, font: helvBold, color: rgb(0.06, 0.09, 0.16),
  });
  page.drawText(verifyUrl, {
    x: left, y: footerY - 12, size: 7.5, font: helv, color: rgb(0.31, 0.36, 0.44),
  });
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

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(400, { error: "Parâmetros inválidos" });
    const { document_id } = parsed.data;

    const token = authHeader.replace("Bearer ", "");
    const claimsRes = await userClient.auth.getClaims(token);
    const aal = (claimsRes.data?.claims as any)?.aal ?? "aal1";
    if (aal !== "aal2") {
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

    const { data: actorProfile } = await admin
      .from("profiles").select("display_name, surgeon_name, concierge_name")
      .eq("user_id", user.id).maybeSingle();
    actor = {
      id: user.id,
      name: actorProfile?.display_name ?? actorProfile?.surgeon_name ?? actorProfile?.concierge_name ?? user.email ?? "Usuário",
      email: user.email ?? null,
    };

    const { data: docRow, error: docErr } = await userClient
      .from("patient_documents").select("*").eq("id", document_id).maybeSingle();
    if (docErr || !docRow) throw new Error("Documento não encontrado ou sem acesso");
    docInfo = { id: docRow.id, title: docRow.title, type: docRow.type };
    if (!docRow.pdf_path) throw new Error("Documento não tem PDF gerado");

    // Fetch template signature_box (if document was generated from a template)
    let signatureBox: SignatureBox | null = null;
    if (docRow.template_id) {
      const { data: tplRow } = await admin
        .from("document_templates")
        .select("signature_box")
        .eq("id", docRow.template_id)
        .maybeSingle();
      const raw = tplRow?.signature_box as any;
      if (raw && typeof raw.x === "number" && typeof raw.y === "number"
        && typeof raw.width === "number" && typeof raw.height === "number") {
        signatureBox = {
          x: raw.x, y: raw.y, width: raw.width, height: raw.height,
          page: typeof raw.page === "number" ? raw.page : undefined,
        };
      }
    }

    const { data: patientRow, error: pErr } = await userClient
      .from("patients").select("id, name, surgeon").eq("id", docRow.patient_id).maybeSingle();
    if (pErr || !patientRow) throw new Error("Paciente não encontrado");
    patient = { id: patientRow.id, name: patientRow.name };

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

    // Professional metadata for visual block
    const { data: profProfile } = await admin
      .from("professional_profiles")
      .select("crm, crm_uf, signature_title")
      .eq("user_id", signer.id).maybeSingle();
    const crmDisplay = profProfile?.crm
      ? `${profProfile.crm}${profProfile.crm_uf ? `/${profProfile.crm_uf}` : ""}`
      : null;
    const specialtyDisplay = profProfile?.signature_title || null;

    const { data: metaRows, error: mErr } = await admin
      .rpc("get_signing_certificate_meta", { _signer_user_id: signer.id });
    if (mErr) throw mErr;
    const meta = (metaRows as any[])?.[0];
    if (!meta) throw new Error(`Dr(a). ${signer.name} ainda não cadastrou o certificado A1`);

    const { data: rolesRows } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    const roles = new Set((rolesRows ?? []).map((r: any) => r.role));
    const isSelf = user.id === signer.id;
    const isAdmin = roles.has("admin");
    const isConciergeOfPatient = roles.has("concierge")
      && actorProfile?.concierge_name
      && (await admin.from("patients").select("concierge").eq("id", patient.id).maybeSingle()).data?.concierge === actorProfile.concierge_name;

    if (!isSelf && !isAdmin) {
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

    const { data: rcount } = await admin.rpc("count_recent_signatures", { _signer_user_id: signer.id });
    if ((rcount as number) >= RATE_LIMIT_PER_24H) {
      await writeAudit("failed", "Limite diário de assinaturas atingido");
      return json(429, { error: "Limite diário de assinaturas atingido para este certificado" });
    }

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

    if (meta.pfx_sha256) {
      const currentHash = await sha256Hex(pfxBuf);
      if (currentHash !== meta.pfx_sha256) {
        await writeAudit("failed", "Hash do certificado divergente");
        return json(409, { error: "Integridade do certificado comprometida — recadastre" });
      }
    }

    // Pre-create the verification record so its id can be embedded in the QR
    const signedAtDate = new Date();
    const { data: verifRow, error: verifErr } = await admin
      .from("signature_verifications")
      .insert({
        document_id: docRow.id,
        signer_user_id: signer.id,
        signer_name: signer.name,
        signer_crm: crmDisplay,
        signer_specialty: specialtyDisplay,
        patient_name_snapshot: patientInitials(patient.name),
        document_title: docInfo.title,
        document_type: docInfo.type,
        signed_at: signedAtDate.toISOString(),
        subject_cn: meta.subject_cn ?? null,
        valid_to: meta.valid_to ?? null,
      })
      .select("id")
      .single();
    if (verifErr || !verifRow) throw new Error(`Falha ao criar verificação: ${verifErr?.message}`);
    const verificationId = verifRow.id as string;

    // Mark any prior verifications for the same document as revoked
    await admin
      .from("signature_verifications")
      .update({ revoked_at: signedAtDate.toISOString() })
      .eq("document_id", docRow.id)
      .neq("id", verificationId)
      .is("revoked_at", null);

    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Visual block (must be added BEFORE the signature placeholder so it is covered by the digest)
    await drawSignatureBlock({
      pdfDoc,
      signerName: signer.name,
      crm: crmDisplay,
      specialty: specialtyDisplay,
      signedAt: signedAtDate,
      verificationId,
      signatureBox,
    });

    pdflibAddPlaceholder({
      pdfDoc, reason: "Assinatura digital ICP-Brasil",
      contactInfo: signer.name, name: signer.name, location: "Brasil",
      signatureLength: 32768,
    });
    const placeheld = await pdfDoc.save();
    const p12 = new P12Signer(pfxBuf as any, { passphrase: secret.password });
    const signedPdf = await new SignPdf().sign(Buffer.from(placeheld), p12);
    const signedBytes = new Uint8Array(signedPdf);
    const finalSha = await sha256Hex(signedBytes);

    const signedPath = docRow.pdf_path.replace(/\.pdf$/i, "_signed.pdf");
    const { error: upErr } = await admin.storage
      .from(DOC_BUCKET)
      .upload(signedPath, signedBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;

    await admin
      .from("signature_verifications")
      .update({ pdf_sha256: finalSha })
      .eq("id", verificationId);

    await admin.from("patient_documents")
      .update({ signed_pdf_path: signedPath, signed_at: signedAtDate.toISOString(), signed_by: signer.id })
      .eq("id", docRow.id);

    await writeAudit("success");

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
              signed_at: signedAtDate.toISOString(),
              ip: ip ?? "—",
            },
          },
        });
      } catch { /* email not critical */ }
    }

    return json(200, { ok: true, signed_pdf_path: signedPath, verification_id: verificationId });
  } catch (e) {
    const msg = (e as Error).message;
    try { await writeAudit("failed", msg); } catch { /* noop */ }
    return json(400, { error: msg });
  }
});
