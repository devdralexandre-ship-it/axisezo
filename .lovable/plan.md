## Hardening de segurança da assinatura A1

Decisões confirmadas:
1. **MFA obrigatório** para cirurgiões com certificado e concierges autorizadas a assinar.
2. **Modo de delegação padrão `always`** (concierge pode assinar livremente em nome do cirurgião delegante; cirurgião pode trocar para `per_document` ou `never` no perfil).
3. **E-mail de notificação** ao cirurgião a cada assinatura feita por terceiros.
4. **Step-up password** obrigatório imediatamente antes de cada assinatura (cirurgião e concierge).

---

### 1. Banco de dados (migration)

**`signing_certificates`**
- `pfx_sha256 text` — hash do `.pfx` para detectar substituição.
- `delegation_mode text default 'always'` — `always` | `per_document` | `never`.

**`patient_documents`**
- `signature_authorized_by uuid` (cirurgião que liberou).
- `signature_authorized_at timestamptz` — usado quando `delegation_mode = per_document`.

**`signature_audit_log`**
- `prev_hash text`, `row_hash text` — cadeia de integridade.
- Trigger `BEFORE INSERT` que calcula `row_hash = sha256(prev_hash || campos)`.
- Reforçar bloqueio: revogar UPDATE/DELETE para todos (já está, manter).

**Storage `signing-certificates`**
- Policy explícita negando SELECT/INSERT/UPDATE/DELETE para role `authenticated` (apenas service role lê via edge function).

**Função `set_signing_certificate`**
- Forçar `_pfx_path` a começar com `_user_id || '/'`; rejeitar caso contrário.

### 2. Edge function `upload-signing-cert`

- Calcular SHA-256 do `.pfx` e gravar em `pfx_sha256`.
- CORS restrito a `axiscrm.app`, `www.axiscrm.app`, `axisezo.lovable.app` e domínios `*.lovable.app` de preview.
- Validar body com Zod.
- Garantir que nenhum `console.log` imprima `password`, bytes do `.pfx` ou `master_key`.

### 3. Edge function `sign-pdf`

- Validar body com Zod (`document_id` UUID + `step_up_password` obrigatório).
- **Step-up**: revalidar a senha do operador com `signInWithPassword` antes de prosseguir; falha → 401 + audit `failed`.
- **MFA gate**: ler AAL do JWT; exigir `aal2` para qualquer operador que vá assinar; sem MFA → erro claro pedindo cadastrar MFA no perfil.
- **Delegação**: ler `delegation_mode` do cirurgião:
  - `never` → bloqueia se ator ≠ cirurgião.
  - `per_document` → exige `signature_authorized_by` no documento.
  - `always` → libera (default).
- **Hash check**: baixar `.pfx`, recalcular SHA-256, comparar com `pfx_sha256`; divergiu → bloqueia + audit + alerta.
- **Rate limit**: máximo 20 assinaturas/24h por `signer_user_id` (consulta no audit log); acima → 429.
- Após assinar, disparar:
  - Notificação no sino para o cirurgião (quando ator ≠ cirurgião).
  - E-mail para o cirurgião (quando ator ≠ cirurgião) via fluxo de e-mail transacional.
- CORS restrito (mesma whitelist).

### 4. Nova edge function `revoke-signing-cert`

- Apaga `.pfx` do storage, zera linha em `signing_certificates`, grava evento especial no audit log (`result='revoked'`). Acionada pelo botão "Revogar agora" no perfil.

### 5. Configuração de Auth

- Habilitar **MFA TOTP** no projeto.
- Habilitar **leaked password protection (HIBP)**.
- Reduzir tempo de sessão / habilitar refresh rotation (já é o padrão; confirmar).

### 6. E-mail transacional

- Configurar domínio de envio (passo guiado pelo Lovable).
- Template "Sua assinatura A1 foi usada" com: nome de quem assinou, paciente, documento, data/hora, IP, link para o histórico no perfil.
- Disparado pela `sign-pdf` apenas quando `acted_by ≠ signer`.

### 7. Frontend

**`Profile.tsx` (cirurgião com certificado)**
- Bloco "Modo de delegação": radio `Sempre` | `Por documento` | `Nunca` (default `always`).
- Botão destacado **"Revogar meu certificado agora"** (vermelho, com confirmação).
- Aviso permanente se MFA não estiver ativo: "Habilite MFA para usar assinatura digital" + link para cadastrar.
- Histórico (já existe) — adicionar coluna IP e badge de "alerta" quando `result='failed'` ou hash mismatch.

**`Profile.tsx` (concierge)**
- Aviso de MFA obrigatório se cirurgiões delegarem para ela.
- Listagem das assinaturas que realizou (já no plano).

**`PatientDocuments.tsx`**
- Quando `delegation_mode = per_document` e ator é concierge: mostrar estado "Aguardando autorização do Dr." e desabilitar botão de assinar até cirurgião clicar "Liberar para assinatura".
- Botão "Liberar para assinatura" visível só para o cirurgião.

**Diálogo de step-up**
- Componente `SignatureConfirmDialog` que abre antes de cada assinatura, exigindo a senha do operador. A senha vai no body da chamada `sign-pdf` (somente em memória, nunca persistida).

**`NotificationBell`**
- Novo tipo `signature_used` com link para o histórico do perfil.

**Rota `/auth/mfa`**
- Tela de cadastro de TOTP (QR code + verificação) usando `supabase.auth.mfa.enroll` / `challenge` / `verify`.
- Forçar passagem por essa tela após login se o usuário tem certificado / é concierge delegada e ainda não tem MFA.

### 8. Memória de segurança

- Atualizar `@security-memory` documentando: certificado A1 sob `PFX_MASTER_KEY`, RLS de `signing_certificates`, audit log encadeado, MFA exigido para signatários, CORS restrito.

---

### Resumo do que muda em arquivos

- **Migrations:** colunas novas em `signing_certificates`, `patient_documents`, `signature_audit_log`; trigger de hash; policies de storage; ajuste em `set_signing_certificate`.
- **Edge functions:** `sign-pdf` reescrita com Zod + step-up + MFA + delegação + rate-limit + hash check + CORS; `upload-signing-cert` ganha SHA-256 + CORS; nova `revoke-signing-cert`.
- **Frontend:** `Profile.tsx`, `PatientDocuments.tsx`, `NotificationBell.tsx`, novo `SignatureConfirmDialog.tsx`, nova rota `/auth/mfa`.
- **Auth config:** MFA TOTP + HIBP.
- **Infra de e-mail transacional:** template "assinatura usada".
- **Hooks:** ampliar `useSigning.ts` com `useUpdateDelegationMode`, `useRevokeCert`, `useAuthorizeDocumentSignature`.

Aprovando, sigo com migration + auth config + edge functions + UI + e-mail nessa ordem.