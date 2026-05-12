import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMfaStatus } from '@/hooks/useSigning';
import { toast } from 'sonner';

export default function MfaEnroll() {
  const navigate = useNavigate();
  const { data: status, refetch } = useMfaStatus();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // clean any unverified factors first
      const { data: list } = await supabase.auth.mfa.listFactors();
      const unverified = (list?.totp ?? []).find(f => f.status !== 'verified');
      if (unverified) await supabase.auth.mfa.unenroll({ factorId: unverified.id });

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) { setError(error.message); return; }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();
  }, []);

  const verify = async () => {
    if (!factorId) return;
    setLoading(true); setError(null);
    try {
      const { data: c, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId, challengeId: c.id, code,
      });
      if (vErr) throw vErr;
      toast.success('MFA ativado com sucesso');
      await refetch();
      navigate('/perfil');
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/perfil"><ArrowLeft className="h-4 w-4" />Voltar</Link>
        </Button>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Verificação em duas etapas (MFA)
        </h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 space-y-6">
        {status?.hasMfa ? (
          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-pipeline-green" /> MFA já está ativo na sua conta.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Use um aplicativo autenticador (Google Authenticator, 1Password, Authy) para escanear o QR code abaixo.
              Em seguida, digite o código de 6 dígitos para confirmar.
            </p>

            {qr ? (
              <div className="flex flex-col items-center gap-3 border border-border rounded-lg p-4">
                <img src={qr} alt="QR code MFA" className="w-48 h-48" />
                {secret && (
                  <div className="text-center">
                    <p className="text-[11px] text-muted-foreground">Código manual:</p>
                    <code className="text-xs font-mono">{secret}</code>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Código de 6 dígitos</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center font-mono text-lg tracking-widest"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {error}
              </p>
            )}

            <Button onClick={verify} disabled={code.length !== 6 || loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Verificando…</> : 'Ativar MFA'}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
