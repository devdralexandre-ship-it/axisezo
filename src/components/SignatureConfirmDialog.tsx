import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useMfaStatus, useVerifyMfaFactor } from '@/hooks/useSigning';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  loading?: boolean;
  signerName?: string | null;
  documentTitle?: string | null;
}

export function SignatureConfirmDialog({ open, onClose, onConfirm, loading, signerName, documentTitle }: Props) {
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const { data: mfa, isLoading: mfaLoading } = useMfaStatus();
  const verifyMfa = useVerifyMfaFactor();

  const needsMfaVerification = !!mfa?.needsVerification;
  const handleClose = () => { setPassword(''); setMfaCode(''); onClose(); };
  const handleConfirm = () => { const p = password.trim(); if (p) onConfirm(p); };
  const handleVerifyMfa = async () => {
    if (mfaCode.length !== 6) return;
    try {
      await verifyMfa.mutateAsync(mfaCode);
      setMfaCode('');
    } catch {
      // Toast is handled by the mutation.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Confirmar assinatura digital
          </DialogTitle>
          <DialogDescription>
            Você está prestes a assinar <span className="font-semibold">{documentTitle ?? 'este documento'}</span>
            {signerName && <> usando o certificado A1 de <span className="font-semibold">{signerName}</span></>}.
            Digite sua senha para confirmar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {needsMfaVerification && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <Label className="text-xs">Código MFA desta sessão</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleVerifyMfa(); }}
                placeholder="000000"
                className="text-center font-mono text-lg tracking-widest"
                disabled={verifyMfa.isPending || loading}
              />
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void handleVerifyMfa()}
                disabled={mfaCode.length !== 6 || verifyMfa.isPending || loading}
              >
                {verifyMfa.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Verificando…</> : 'Verificar MFA agora'}
              </Button>
            </div>
          )}
          <Label className="text-xs">Sua senha de acesso</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            autoFocus
            disabled={loading}
          />
          <p className="text-[11px] text-muted-foreground">
            A senha é usada apenas para confirmar a operação e não é armazenada.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!password || loading || mfaLoading || needsMfaVerification}>
            {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Assinando…</> : 'Assinar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
