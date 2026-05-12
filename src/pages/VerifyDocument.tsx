import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Verification {
  found: boolean;
  id?: string;
  signer_name?: string;
  signer_crm?: string | null;
  signer_specialty?: string | null;
  patient_name_snapshot?: string | null;
  document_title?: string;
  document_type?: string | null;
  signed_at?: string;
  pdf_sha256?: string | null;
  subject_cn?: string | null;
  valid_to?: string | null;
  revoked_at?: string | null;
}

const PROJECT = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ENDPOINT = `https://${PROJECT}.supabase.co/functions/v1/verify-document`;

function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(d));
  } catch { return d; }
}

export default function VerifyDocument() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = "Verificação de Assinatura Digital";
    const meta = document.querySelector('meta[name="description"]') ||
      (() => { const m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); return m; })();
    meta.setAttribute("content", "Validação pública da assinatura digital ICP-Brasil de documento médico.");
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok && r.status !== 404) throw new Error(body?.error ?? "Erro");
        setData(body);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const status = !data?.found
    ? "not_found"
    : data.revoked_at
      ? "revoked"
      : "valid";

  const copyHash = async () => {
    if (!data?.pdf_sha256) return;
    await navigator.clipboard.writeText(data.pdf_sha256);
    setCopied(true);
    toast.success("Hash copiado");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Axis CRM</p>
            <h1 className="text-base font-semibold">Verificação de Assinatura Digital</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {loading && <p className="text-muted-foreground">Carregando…</p>}
        {error && <p className="text-destructive">{error}</p>}

        {!loading && !error && (
          <>
            <Card className={
              status === "valid" ? "border-emerald-500/40 bg-emerald-500/5" :
              status === "revoked" ? "border-amber-500/40 bg-amber-500/5" :
              "border-destructive/40 bg-destructive/5"
            }>
              <CardContent className="pt-6 flex items-start gap-4">
                {status === "valid" ? (
                  <ShieldCheck className="h-10 w-10 text-emerald-600 shrink-0" />
                ) : (
                  <ShieldAlert className="h-10 w-10 text-amber-600 shrink-0" />
                )}
                <div>
                  <h2 className="text-lg font-semibold">
                    {status === "valid" && "Assinatura registrada"}
                    {status === "revoked" && "Documento revogado / substituído"}
                    {status === "not_found" && "Verificação não encontrada"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {status === "valid" &&
                      "Os metadados abaixo foram registrados no momento da assinatura ICP-Brasil. Para validação criptográfica completa, abra o PDF no Adobe Reader ou em validar.iti.gov.br."}
                    {status === "revoked" &&
                      "Este registro foi marcado como revogado porque o documento foi reassinado. Use o QR Code da versão mais recente."}
                    {status === "not_found" &&
                      "Nenhum registro corresponde a este identificador."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {data?.found && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Metadados da assinatura</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
                  <Field label="Signatário" value={data.signer_name} />
                  <Field label="CRM" value={data.signer_crm} />
                  <Field label="Especialidade" value={data.signer_specialty} />
                  <Field label="Paciente (iniciais)" value={data.patient_name_snapshot} />
                  <Field label="Documento" value={data.document_title} />
                  <Field label="Tipo" value={data.document_type} />
                  <Field label="Assinado em" value={fmt(data.signed_at)} />
                  <Field label="Certificado válido até" value={data.valid_to ?? "—"} />
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Subject CN</p>
                    <p className="font-mono text-xs break-all">{data.subject_cn ?? "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Hash SHA-256 do PDF</p>
                    <div className="flex items-start gap-2">
                      <p className="font-mono text-xs break-all flex-1">{data.pdf_sha256 ?? "—"}</p>
                      {data.pdf_sha256 && (
                        <Button size="sm" variant="ghost" onClick={copyHash}>
                          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  {data.revoked_at && (
                    <div className="sm:col-span-2">
                      <Badge variant="outline" className="border-amber-500/50 text-amber-700">
                        Revogado em {fmt(data.revoked_at)}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground text-center pt-4">
              Este registro confirma a existência da assinatura. A validação criptográfica
              definitiva é feita abrindo o PDF original no Adobe Reader ou em
              {" "}
              <a className="underline" href="https://validar.iti.gov.br" target="_blank" rel="noreferrer">
                validar.iti.gov.br
              </a>.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
