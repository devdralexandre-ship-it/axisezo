import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Trash2, Upload, ShieldCheck, AlertCircle, History } from 'lucide-react';
import { useProfessionalProfile, useSaveProfessionalProfile } from '@/hooks/useProfessionalProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useMyDefaults, useDeleteDefault } from '@/hooks/useDefaultProcedureCodes';
import { useAuth } from '@/contexts/AuthContext';
import {
  useMySigningCertificate,
  useUploadSigningCertificate,
  useDeleteSigningCertificate,
  useSignatureAuditAsSigner,
  useSignatureAuditAsActor,
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
  const deleteCert = useDeleteSigningCertificate();
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
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Assinatura digital A1 (ICP-Brasil)</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Em breve você poderá enviar o seu certificado A1 (.pfx) para que o sistema assine automaticamente os PDFs gerados.
              A chave privada ficará criptografada e usada apenas para assinar documentos emitidos por você.
            </p>
          </div>
          <div className="border border-dashed border-border rounded-lg p-4 text-sm text-muted-foreground">
            Aguardando configuração da chave-mestra de criptografia (<code className="font-mono text-xs">PFX_MASTER_KEY</code>) para ativar este recurso.
            Adicione-a nas configurações de Lovable Cloud quando estiver pronto e o upload do certificado será liberado.
          </div>
        </section>

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
