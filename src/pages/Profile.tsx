import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Trash2, Upload, ShieldCheck, AlertCircle, History, ShieldAlert } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useProfessionalProfile, useSaveProfessionalProfile } from '@/hooks/useProfessionalProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useMyDefaults, useDeleteDefault } from '@/hooks/useDefaultProcedureCodes';
import { useAuth } from '@/contexts/AuthContext';
import {
  useMySigningCertificate,
  useUploadSigningCertificate,
  useRevokeSigningCertificate,
  useSetDelegationMode,
  useSignatureAuditAsSigner,
  useSignatureAuditAsActor,
  useMfaStatus,
} from '@/hooks/useSigning';

const KIND_LABEL: Record<string, string> = {
  cbhpm_main: 'CBHPM principal',
  cbhpm_extra: 'CBHPM extra',
  cid: 'CID',
  opme: 'OPME',
};

export default function Profile() {
  const { data: profile, isLoading } = useProfessionalProfile();
  const save = useSaveProfessionalProfile();
  const { surgeonName, conciergeName, displayName, isSurgeon, isConcierge } = useUserRole();
  const { user } = useAuth();
  const { data: myCert } = useMySigningCertificate(user?.id);
  const uploadCert = useUploadSigningCertificate();
  const revokeCert = useRevokeSigningCertificate();
  const setMode = useSetDelegationMode();
  const { data: mfa } = useMfaStatus();
  const { data: signerAudit = [] } = useSignatureAuditAsSigner(isSurgeon ? user?.id : undefined);
  const { data: actorAudit = [] } = useSignatureAuditAsActor(isConcierge ? user?.id : undefined);

  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState('');

  const handleUploadCert = () => {
    if (!pfxFile || !pfxPassword) return;
    uploadCert.mutate(
      { file: pfxFile, password: pfxPassword },
      { onSuccess: () => { setPfxFile(null); setPfxPassword(''); } },
    );
  };

  const formatDateTime = (s: string) => {
    const d = new Date(s);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };


  const [crm, setCrm] = useState('');
  const [crmUf, setCrmUf] = useState('');
  const [rqe, setRqe] = useState('');
  const [signatureTitle, setSignatureTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (profile) {
      setCrm(profile.crm ?? '');
      setCrmUf(profile.crm_uf ?? '');
      setRqe(profile.rqe ?? '');
      setSignatureTitle(profile.signature_title ?? '');
      setPhone(profile.phone_professional ?? '');
      setEmail(profile.email_professional ?? '');
    }
  }, [profile]);

  const handleSave = () => {
    save.mutate({
      crm, crm_uf: crmUf, rqe,
      signature_title: signatureTitle,
      phone_professional: phone,
      email_professional: email,
    });
  };

  // Defaults section
  const defaultsScope = isSurgeon ? 'surgeon' : isConcierge ? 'concierge' : null;
  const defaultsOwner = isSurgeon ? surgeonName : isConcierge ? conciergeName : null;
  const { data: defaults = [] } = useMyDefaults(
    (defaultsScope ?? 'surgeon') as any,
    defaultsOwner ?? undefined,
  );
  const deleteDefault = useDeleteDefault();

  const groupedDefaults = defaults.reduce<Record<string, typeof defaults>>((acc, row) => {
    (acc[row.procedure] ??= []).push(row);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/"><ArrowLeft className="h-4 w-4" />Voltar</Link>
        </Button>
        <h1 className="text-lg font-semibold">Meu perfil profissional</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Identificação</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Estes dados serão usados na assinatura de todos os documentos que você emitir.
            </p>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome de exibição</Label>
                  <Input value={displayName ?? ''} disabled className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Especialidade / título da assinatura</Label>
                  <Input value={signatureTitle} onChange={(e) => setSignatureTitle(e.target.value)} placeholder="Ex.: Urologista" className="h-9 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">CRM</Label>
                  <Input value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="Ex.: 25959" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">UF</Label>
                  <Input value={crmUf} onChange={(e) => setCrmUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="BA" className="h-9 text-sm" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">RQE</Label>
                <Input value={rqe} onChange={(e) => setRqe(e.target.value)} placeholder="Ex.: 20028" className="h-9 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Telefone profissional</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail profissional</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={save.isPending}>
                  <Save className="h-4 w-4" />
                  {save.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </section>

        {defaultsOwner && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Meus códigos padrão</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Códigos CBHPM, CID e OPME que você marcou para usar automaticamente nas próximas solicitações cirúrgicas.
              </p>
            </div>

            {Object.keys(groupedDefaults).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhum padrão salvo ainda. Eles aparecerão aqui depois que você marcar "Salvar como padrão" ao gerar uma solicitação cirúrgica.
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedDefaults).map(([procedure, rows]) => (
                  <div key={procedure} className="border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-2">{procedure}</h3>
                    <ul className="space-y-1">
                      {rows.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">
                            <span className="text-[10px] uppercase font-semibold text-muted-foreground mr-2">{KIND_LABEL[r.kind]}</span>
                            {r.code && <span className="font-mono text-xs mr-2">{r.code}</span>}
                            {r.label}
                            {r.kind === 'opme' && r.quantity > 1 && <span className="text-muted-foreground ml-1">× {r.quantity}</span>}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive shrink-0"
                            onClick={() => deleteDefault.mutate(r.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Assinatura digital A1 (ICP-Brasil)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Envie o seu certificado A1 (.pfx). A chave privada fica criptografada no servidor e
              só é usada para assinar PDFs deste sistema. {isSurgeon && 'A concierge atribuída ao paciente pode acionar a assinatura em seu nome — todo uso fica registrado abaixo.'}
            </p>
          </div>

          {!mfa?.hasMfa && (
            <div className="border border-pipeline-amber/40 bg-pipeline-amber/5 rounded-lg p-3 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-pipeline-amber mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-medium">MFA é obrigatório para usar a assinatura digital.</p>
                <RouterLink to="/perfil/mfa" className="text-primary hover:underline">Ativar MFA agora →</RouterLink>
              </div>
            </div>
          )}

          {myCert ? (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-pipeline-green shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{myCert.subject_cn ?? 'Certificado A1 cadastrado'}</p>
                  <p className="text-xs text-muted-foreground">
                    Validade: {myCert.valid_from ?? '?'} → {myCert.valid_to ?? '?'}
                  </p>
                  {myCert.valid_to && new Date(myCert.valid_to) < new Date() && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" /> Certificado expirado
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm('Revogar seu certificado A1? Você precisará cadastrá-lo novamente para voltar a assinar.')) {
                      revokeCert.mutate();
                    }
                  }}
                  disabled={revokeCert.isPending}
                >
                  <Trash2 className="h-4 w-4" /> Revogar agora
                </Button>
              </div>

              {isSurgeon && (
                <div className="border-t pt-3">
                  <Label className="text-xs uppercase font-bold tracking-wide text-muted-foreground">Modo de delegação</Label>
                  <p className="text-[11px] text-muted-foreground mb-2">Quem pode assinar usando seu certificado.</p>
                  <div className="flex gap-2">
                    {(['always', 'per_document', 'never'] as const).map((m) => (
                      <Button
                        key={m}
                        size="sm"
                        variant={myCert.delegation_mode === m ? 'default' : 'outline'}
                        onClick={() => setMode.mutate(m)}
                        disabled={setMode.isPending}
                      >
                        {m === 'always' ? 'Sempre' : m === 'per_document' ? 'Por documento' : 'Nunca'}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Arquivo .pfx</Label>
                <Input
                  type="file"
                  accept=".pfx,.p12,application/x-pkcs12"
                  onChange={(e) => setPfxFile(e.target.files?.[0] ?? null)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Senha do certificado</Label>
                <Input
                  type="password"
                  value={pfxPassword}
                  onChange={(e) => setPfxPassword(e.target.value)}
                  placeholder="Senha utilizada na emissão"
                  className="h-9 text-sm"
                />
              </div>
              <Button
                onClick={handleUploadCert}
                disabled={!pfxFile || !pfxPassword || uploadCert.isPending}
                size="sm"
              >
                <Upload className="h-4 w-4" />
                {uploadCert.isPending ? 'Enviando…' : 'Enviar certificado'}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                A senha será criptografada antes de ser armazenada e nunca poderá ser lida por outro usuário.
              </p>
            </div>
          )}
        </section>

        {isSurgeon && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <History className="h-4 w-4" /> Histórico de uso do meu certificado
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Toda vez que seu certificado A1 é usado — por você ou por uma concierge agindo em seu nome — fica registrado aqui.
              </p>
            </div>
            {signerAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma assinatura registrada ainda.</p>
            ) : (
              <div className="border border-border rounded-lg divide-y">
                {signerAudit.map((row) => (
                  <div key={row.id} className="p-3 text-sm flex items-start gap-3">
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${row.result === 'success' ? 'bg-pipeline-green' : 'bg-destructive'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">
                        <span className="font-medium">{row.document_title ?? 'Documento'}</span>
                        {row.patient_name_snapshot && <> — {row.patient_name_snapshot}</>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(row.signed_at)} · assinado por{' '}
                        <span className={row.acted_by_user_id === user?.id ? '' : 'font-semibold text-foreground'}>
                          {row.acted_by_user_id === user?.id ? 'você' : (row.acted_by_name ?? 'outro usuário')}
                        </span>
                        {row.result !== 'success' && row.error_message && (
                          <span className="text-destructive"> · {row.error_message}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isConcierge && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <History className="h-4 w-4" /> Assinaturas que realizei
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Documentos que você assinou usando o certificado dos cirurgiões.
              </p>
            </div>
            {actorAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma assinatura registrada ainda.</p>
            ) : (
              <div className="border border-border rounded-lg divide-y">
                {actorAudit.map((row) => (
                  <div key={row.id} className="p-3 text-sm flex items-start gap-3">
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${row.result === 'success' ? 'bg-pipeline-green' : 'bg-destructive'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">
                        <span className="font-medium">{row.document_title ?? 'Documento'}</span>
                        {row.patient_name_snapshot && <> — {row.patient_name_snapshot}</>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(row.signed_at)} · certificado de{' '}
                        <span className="font-semibold text-foreground">{row.signer_name ?? 'cirurgião'}</span>
                        {row.result !== 'success' && row.error_message && (
                          <span className="text-destructive"> · {row.error_message}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Em breve</h2>
          <p className="text-sm text-muted-foreground">
            Seus templates pessoais de documentos aparecerão aqui para edição direta.
          </p>
        </section>

      </main>
    </div>
  );
}
