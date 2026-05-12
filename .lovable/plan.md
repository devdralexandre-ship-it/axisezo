## Delegação de assinatura A1 + log de auditoria

A concierge precisa poder assinar documentos usando o certificado A1 do cirurgião responsável pelo paciente, e cada uso precisa ficar registrado num log que o próprio cirurgião consulta.

### 1. Modelo de delegação (quem pode usar o certificado de quem)

Hoje o RLS de `signing_certificates` só permite o próprio dono (ou admin) ler/usar o certificado. Vou ampliar para que a concierge possa **usar (assinar)** o certificado dos cirurgiões dos seus pacientes, mas **não** baixar, alterar ou ver a senha.

Regras:
- O cirurgião continua sendo o único que faz upload, troca senha ou remove o próprio certificado.
- A concierge só pode acionar "Assinar com A1 do Dr. X" para um paciente cujo `surgeon` corresponde ao cirurgião dela (já controlado por `can_access_patient`).
- O admin pode assinar em nome de qualquer cirurgião (uso administrativo).
- O acesso ao `.pfx` e à senha descriptografada **só acontece dentro da edge function** `sign-pdf`, nunca exposto ao cliente.

A leitura direta da tabela continua restrita ao dono — a concierge só vê metadados mínimos (CN + validade do cirurgião responsável) via uma RPC `get_surgeon_cert_status(patient_id)` que retorna apenas se existe certificado ativo, sem expor caminhos nem senha.

### 2. Edge function `sign-pdf` — quem assina vs. quem é assinado

A função passa a aceitar dois conceitos separados:
- **`signer_user_id`** = dono do certificado (o cirurgião)
- **`acting_user_id`** = quem clicou no botão (`auth.uid()`, pode ser a própria concierge)

Fluxo:
1. Recebe `document_id`.
2. Resolve o `patient` → identifica o `surgeon` (pelo nome) → resolve para `signer_user_id` via `profiles.surgeon_name`.
3. Valida autorização: o `acting_user_id` é admin, é o próprio cirurgião, **ou** é a concierge daquele paciente (via `can_access_patient` + role `concierge`).
4. Carrega o `.pfx` e descriptografa a senha do cirurgião.
5. Assina o PDF, salva como `*_signed.pdf`.
6. Grava no log de auditoria (ver seção 3).
7. Atualiza `patient_documents` (`signed_pdf_path`, `signed_at`, `signed_by` = `signer_user_id`).

Se não houver certificado do cirurgião responsável, retorna erro claro: "O Dr. X ainda não cadastrou o certificado A1 dele. Peça para ele configurar em Perfil."

### 3. Log de auditoria

Nova tabela `signature_audit_log`:
- `signer_user_id` — dono do certificado (cirurgião)
- `acted_by_user_id` — quem clicou (pode ser a concierge)
- `acted_by_name` — snapshot do nome de quem assinou (para histórico legível)
- `patient_id`, `patient_name_snapshot`
- `document_id`, `document_title`, `document_type`
- `signed_at`, `ip_address`, `user_agent`
- `result` (`success` | `failed`), `error_message`

RLS:
- Cirurgião (`signer_user_id = auth.uid()`) vê **todos os usos do seu certificado** — inclusive falhas.
- Concierge vê apenas as próprias ações (`acted_by_user_id = auth.uid()`).
- Admin vê tudo.
- Insert: somente service role (a edge function), nunca client-side.

### 4. UI

**Em `PatientDocuments.tsx`:**
- Botão "Assinar com A1" aparece se houver certificado ativo do cirurgião do paciente (consulta via RPC).
- Tooltip mostra: "Assinará usando o certificado de Dr. X (válido até DD/MM/AAAA)".
- Após assinatura, mostra "Assinado em DD/MM HH:MM por {acted_by} — certificado de Dr. X" + botão para baixar o PDF assinado.

**Em `Profile.tsx` (visão do cirurgião):**
- Nova seção **"Histórico de uso do meu certificado"** abaixo do bloco A1.
- Lista cronológica reversa: data/hora, paciente, documento, **quem assinou** (próprio nome ou nome da concierge), resultado.
- Filtro por período e por usuário.
- Aviso de destaque se houver assinatura feita por terceiros nas últimas 24h ("Sua assinatura foi usada por {concierge} em {N} documentos hoje").

**Em `Profile.tsx` (visão da concierge):**
- Seção **"Assinaturas que realizei"** — lista das assinaturas que ela fez em nome de cada cirurgião, para sua própria referência.

### 5. Notificação ao cirurgião

Quando a concierge assina em nome do cirurgião, criar uma notificação no sino (`NotificationBell`) para o cirurgião:
> "Maria assinou a Solicitação Cirúrgica do paciente João Silva usando seu certificado A1."

Link clicável vai para o histórico no perfil.

### 6. Resumo das alterações

**Migration:**
- Tabela `signature_audit_log` + RLS conforme acima.
- RPC `get_surgeon_cert_status(patient_id)` retornando `{ has_cert, subject_cn, valid_to }` — security definer, valida acesso ao paciente.

**Edge function `sign-pdf`:** lógica de delegação, gravação no log (sucesso e falha), trigger de notificação.

**Front-end:**
- `PatientDocuments.tsx` — botão e estado pós-assinatura.
- `Profile.tsx` — duas novas seções (histórico do cirurgião / assinaturas da concierge).
- `NotificationBell` — consumir o novo tipo de notificação.

**Segurança:**
- A senha do `.pfx` nunca sai do servidor.
- Concierge nunca recebe o `.pfx` nem a senha — só dispara a assinatura.
- Cada uso é rastreável e visível ao dono do certificado.

### Pendência conhecida
Continua faltando o secret `PFX_MASTER_KEY` para ativar o fluxo completo. O plano fica pronto para entrar em produção assim que você adicionar a chave.

Aprovando, sigo com a migration + edge function + UI.
