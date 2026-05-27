# Por que Margô vê só 106 de 160

Consultando o banco:

- Profile da Margô: `concierge_name = "Margô"`, role = `concierge`, `assigned_only = false`.
- Distribuição do campo `concierge` na tabela `patients`:
  - `"Margô"` → **110 pacientes**
  - `""` (string vazia) → **54 pacientes**

A política RLS `can_access_patient` para um usuário com role `concierge` (sem `admin`, sem `call_center`/`intern`) só libera o paciente quando `patients.concierge = current_concierge_name()`. Como 54 pacientes estão com concierge em branco, eles ficam invisíveis para ela — daí a diferença (~160 totais vs ~106 visíveis; a sua conta admin vê tudo).

A origem dos brancos é principalmente o `useImportPatients` (CSV), que insere `concierge: ''` fixo, e provavelmente cadastros antigos feitos por call_center/admin sem preencher o campo.

# Correção proposta

### 1) Backfill no banco (migration)
Atualizar todos os pacientes com concierge vazio/nulo para `"Margô"`, já que hoje ela é a única concierge ativa:

```sql
UPDATE public.patients
SET concierge = 'Margô'
WHERE concierge IS NULL OR btrim(concierge) = '';
```

### 2) Evitar regressão no CSV import
Em `src/hooks/usePatients.ts` → `useImportPatients`: receber também um `defaultConcierge` (igual ao padrão já feito com surgeon) e usar no insert em vez de string vazia. Atualizar `src/components/CsvImporter.tsx` para passar a concierge padrão (atual do usuário logado, ou seleção pelo admin).

### 3) Default no formulário de cadastro
Em `AddPatientForm`, quando o usuário logado tem role `concierge`, pré-preencher o campo Concierge com o `conciergeName` do profile (o `useAddPatient` já faz isso como defesa em profundidade, mas o usuário deve ver o valor na UI).

# O que NÃO mexer

- A RLS está correta — a regra "concierge só vê seus próprios pacientes" é intencional.
- Não há problema de encoding ("Margô" bate exatamente em hex).
- Não preciso alterar policies nem `can_access_patient`.

# Verificação após aplicar

Rodar:
```sql
SELECT count(*) FROM patients WHERE concierge = 'Margô';
```
Deve passar de 110 para 164 (110 + 54). Margô faz hard refresh e passa a ver todos.

---

**Pergunta antes de implementar:** confirma que **todos** os 54 pacientes com concierge em branco devem ir para Margô? Se houver pacientes que pertencem a outra concierge (futura/inativa), me diga quais critérios usar — caso contrário aplico o backfill global para "Margô".
