# Plano — Hardening de segurança e controle de acesso

## Objetivo

Substituir o modelo atual ("qualquer autenticado vê tudo") por **RLS escopada por papel**, fechar o cadastro público e dar a você um painel admin para gerir contas. Resolver os 31 findings de segurança hoje em aberto.

---

## 1. Modelo de papéis e identidade operacional

### 1a. Enum de papéis (já existe `app_role`)
Garantir que tem: `admin`, `surgeon`, `concierge`, `call_center`. Adicionar o que faltar.

### 1b. Estender `profiles` com identidade operacional
```sql
ALTER TABLE profiles
  ADD COLUMN surgeon_name text,
  ADD COLUMN concierge_name text,
  ADD COLUMN active boolean NOT NULL DEFAULT true;
```

`surgeon_name` / `concierge_name` precisam casar **exatamente** com `patients.surgeon` e `patients.concierge` (que são strings hoje). É o que liga o `auth.uid()` aos pacientes dele.

### 1c. Mapeamento inicial dos usuários

| user | papéis (`user_roles`) | `profiles.surgeon_name` | `profiles.concierge_name` |
|---|---|---|---|
| Alexandre Ziomkowski | admin, surgeon | Alexandre Ziomkowski | — |
| Yuri Motta | admin, surgeon | Yuri Motta | — |
| Ramon Campos Nascimento | admin, surgeon | Ramon Campos Nascimento | — |
| Lauro Almeida | surgeon | Lauro Almeida | — |
| João Rafael Libório Estrela | surgeon | João Rafael Libório Estrela | — |
| Margarete Aleixo | concierge | — | Margarete Aleixo |
| Admin Teste | **deletar conta + profile** | — | — |
| Íris | (deixar pendente — eu cadastro depois pelo painel admin) | — | — |

Vou executar essas atribuições via insert tool após criar o schema.

---

## 2. Funções `SECURITY DEFINER` para evitar recursão de RLS

```sql
-- Nome operacional do cirurgião logado (NULL se não for cirurgião)
CREATE FUNCTION current_surgeon_name() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT surgeon_name FROM profiles
  WHERE user_id = auth.uid() AND active = true
$$;

-- Nome operacional do concierge logado
CREATE FUNCTION current_concierge_name() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concierge_name FROM profiles
  WHERE user_id = auth.uid() AND active = true
$$;

-- Permissão consolidada: o usuário pode ver/mexer neste paciente?
CREATE FUNCTION can_access_patient(_patient_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    has_role(auth.uid(), 'admin')                                                 -- admin: tudo
    OR has_role(auth.uid(), 'call_center')                                        -- call_center (Íris): tudo
    OR EXISTS (
      SELECT 1 FROM patients p WHERE p.id = _patient_id AND (
        (has_role(auth.uid(), 'surgeon')   AND p.surgeon   = current_surgeon_name())
        OR (has_role(auth.uid(), 'concierge') AND p.concierge = current_concierge_name())
      )
    )
$$;
```

---

## 3. Substituir RLS de **todas** as tabelas operacionais

Tabelas afetadas: `patients`, `tasks`, `contact_records`, `pending_items`, `preop_checklist_items`, `patient_documents`.

Para cada uma, dropar as 4 policies `USING (true)` e criar:

```sql
-- patients (exemplo; demais tabelas usam can_access_patient(patient_id))
CREATE POLICY "scoped_select" ON patients FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'call_center')
    OR (has_role(auth.uid(), 'surgeon')   AND surgeon   = current_surgeon_name())
    OR (has_role(auth.uid(), 'concierge') AND concierge = current_concierge_name())
  );

CREATE POLICY "scoped_insert" ON patients FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'call_center')
    OR (has_role(auth.uid(), 'concierge') AND concierge = current_concierge_name())
    OR (has_role(auth.uid(), 'surgeon')   AND surgeon   = current_surgeon_name())
  );

CREATE POLICY "scoped_update" ON patients FOR UPDATE TO authenticated
  USING (...mesma regra do select...) WITH CHECK (...mesma regra...);

CREATE POLICY "scoped_delete" ON patients FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));   -- só admin deleta paciente
```

Para tabelas-filhas (`tasks`, `contact_records`, etc.):
```sql
USING (can_access_patient(patient_id))
WITH CHECK (can_access_patient(patient_id))
```

---

## 4. Esconder dados financeiros da Íris (call_center)

Decisão: Íris vê todos os pacientes mas **não** vê valores monetários.

Estratégia: **view com `security_invoker=on`** que omite os campos financeiros, e a aplicação consulta a view quando o usuário tem `call_center`. Os campos escondidos:
`estimated_value`, `medical_fees`, `anesthesia_fees`, `hospital_budget`, `materials_cost`, `billing_type`.

```sql
CREATE VIEW patients_no_financials WITH (security_invoker=on) AS
  SELECT id, name, age, patient_type, procedure_name, procedure_category,
         surgical_approach, laterality, surgeon, concierge, owner, stage,
         stage_entered_at, decision_status, last_interaction_date,
         next_follow_up_date, phone, email, indication_date, indication_location,
         payer, responsible_contact, desired_hospital, notes, alerts,
         loss_reason, loss_reason_detail, created_at, updated_at,
         NULL::numeric AS estimated_value,
         NULL::numeric AS medical_fees,
         NULL::numeric AS anesthesia_fees,
         NULL::numeric AS hospital_budget,
         NULL::numeric AS materials_cost,
         NULL::text    AS billing_type
  FROM patients;
```

No client (`usePatients.ts`), detectar papel call_center e consultar `patients_no_financials` em vez de `patients`. Componentes de valor (`PipelineDashboard` totais, formulários financeiros) ficam ocultos para call_center via flag `useUserRole()`.

---

## 5. Fechar cadastro público

### 5a. `Auth.tsx`
- Remover toggle "Criar conta" e o formulário de signup.
- Manter só email + senha + login.
- Adicionar link "Esqueci minha senha" (recovery via email).

### 5b. Mensagem
"O cadastro de novos usuários é feito pelo administrador. Fale com o admin da clínica."

---

## 6. Painel admin de usuários (`/admin/users`)

Rota protegida — só `has_role(admin)` entra. Funcionalidades:

- Listar todos os profiles + papéis + status ativo.
- **Criar usuário**: email, senha temporária, nome, papéis (multi), surgeon_name (se surgeon), concierge_name (se concierge).
- **Editar**: alterar papéis, nomes operacionais, ativar/desativar.
- **Resetar senha** (envia email de recuperação).
- **Deletar** (remove do auth e do profile).

Implementação:
- Edge function `admin-users` com `verify_jwt = true` (vai validar JWT em código), checa `has_role(admin)` e usa `SUPABASE_SERVICE_ROLE_KEY` para `auth.admin.createUser`, `updateUser`, `deleteUser`. Validação de input com Zod.
- UI React com tabela + modal de criar/editar.

---

## 7. Limpezas e ativações

### 7a. Deletar "Admin Teste"
Pelo edge function depois de ele estar deployed (precisa do service role), ou via insert tool no profile + auth admin API.

### 7b. Ativar HIBP (proteção contra senhas vazadas)
Via tool de configuração de auth. Garante que ninguém cadastre senha que já vazou em algum lugar.

### 7c. Documentar `.env`
Adicionar seção curta no `README.md` explicando: o `.env` deste projeto contém só chaves públicas (URL do backend e anon key). Não são segredos. O anon key sozinho não dá acesso a nada — toda proteção real vem da RLS. Os segredos reais (`SUPABASE_SERVICE_ROLE_KEY`, etc.) ficam no cofre do Lovable Cloud, nunca no código.

---

## 8. Hooks e UI

### 8a. `useUserRole.ts` (novo)
Hook que retorna `{ isAdmin, isSurgeon, isConcierge, isCallCenter, surgeonName, conciergeName, loading }`. Usado em toda a app para esconder/mostrar elementos.

### 8b. Esconder financeiros para call_center
- `PipelineDashboard`: esconde totais de valor.
- `AddPatientForm` / `PatientPanel`: esconde campos de honorários/orçamentos.
- Card de paciente: esconde "valor estimado".

### 8c. Filtragem natural
Como a RLS já filtra no banco, o front não precisa de lógica de filtragem por cirurgião — `usePatients()` simplesmente retorna o que o backend deixou passar. Isso já elimina vazamento acidental.

---

## 9. Findings de segurança

Marcar como `mark_as_fixed` os 31 findings que estavam sinalizando "tabela X com RLS permissiva" depois que as policies novas estiverem aplicadas. Os 24 warnings restantes (ex.: HIBP desligado) também serão fechados nesta etapa.

---

## Arquivos afetados

**Migração SQL** (1 grande migration):
- alter `profiles` (+ surgeon_name, concierge_name, active)
- create funcs `current_surgeon_name`, `current_concierge_name`, `can_access_patient`
- drop + recreate policies em 6 tabelas
- create view `patients_no_financials`
- garantir enum `app_role` com call_center

**Insert tool** (atribuir papéis e nomes operacionais aos 7 usuários atuais).

**Código:**
- `src/pages/Auth.tsx` — remover signup, adicionar reset.
- `src/hooks/useUserRole.ts` — **novo**.
- `src/hooks/usePatients.ts` — usar view quando call_center.
- `src/pages/AdminUsers.tsx` — **novo**.
- `src/components/AdminUserDialog.tsx` — **novo**.
- `src/App.tsx` — rota `/admin/users` protegida por admin.
- `src/components/PipelineDashboard.tsx`, `AddPatientForm.tsx`, `PatientPanel.tsx`, `PatientCard.tsx` — esconder financeiros para call_center.
- `supabase/functions/admin-users/index.ts` — **novo** edge function.
- `README.md` — seção curta sobre `.env`.

**Config:**
- HIBP enabled via configure_auth.

---

## Verificação

1. Login como você (Alexandre): vê todos os pacientes, todos os valores, acessa `/admin/users`.
2. Login como Lauro: vê apenas pacientes onde `surgeon = "Lauro Almeida"`. Não vê outros. Não acessa `/admin/users`.
3. Login como Margarete: vê apenas pacientes onde `concierge = "Margarete Aleixo"`. Vê valores. Não acessa `/admin/users`.
4. Login como Íris (depois que você cadastrar): vê todos os pacientes, mas todos os campos de valor aparecem em branco/escondidos.
5. Tentar criar conta nova em `/auth`: não consegue, formulário de signup não existe mais.
6. Linter de segurança: 31 findings devem ir a 0.

## Limitações e cuidados

- **Mão única**: depois que a RLS escopada estiver no ar, qualquer paciente sem `surgeon` ou `concierge` correto vai ficar invisível para o cirurgião/concierge correspondente. Vou rodar uma checagem antes de aplicar para garantir que os nomes em `patients.surgeon` batem 100% com o que vou colocar em `profiles.surgeon_name`.
- **Concierge único hoje**: Margarete é a única. Quando adicionar outras, basta criar a conta no painel admin com `concierge_name` próprio.
- **Íris pendente**: o painel admin já estará pronto para você cadastrar quando quiser.

Aprove para eu aplicar.