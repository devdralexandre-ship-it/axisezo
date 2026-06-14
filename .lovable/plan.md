# Correção do valor no card + Detecção de duplicatas

## Diagnóstico

**1. Valor antigo no card (Thales Silva Machado)**
O card lê `patient.estimatedValue ?? patient.medicalFees` (`PatientCard.tsx:44`). No banco, esse paciente tem `estimated_value = 6` (valor legado/erro de digitação antigo) e `medical_fees = 6000`. Como o painel de edição (`PatientPanel.tsx`) **nunca atualiza `estimated_value`** — só grava `medical_fees`, `anesthesia_fees`, `hospital_budget`, `materials_cost` — o card continua mostrando o valor velho de `estimated_value`. Editar honorários funciona no banco; apenas a exibição usa um campo obsoleto.

**2. Duplicata**
Existem duas linhas para "Thales Silva Machado": uma com nome `"Thales Silva Machado"` e outra com espaço à esquerda `" Thales Silva Machado"`. Não há nenhum mecanismo que detecte/avise duplicatas no cadastro nem ferramenta para revisá-las.

## Mudanças propostas

### Parte A — Card mostra valor correto
1. **`PatientCard.tsx`**: trocar `displayValue` por um total calculado:
   `medicalFees + anesthesiaFees + hospitalBudget + materialsCost`, com fallback para `estimatedValue` apenas se todos os fees forem nulos. Assim qualquer edição de honorários reflete imediatamente.
2. **`PatientPanel.tsx`** (handleSave dos campos financeiros): ao salvar, também limpar `estimated_value` (definir como `null`) para esse campo legado deixar de competir com os fees. Mantém compatibilidade com registros antigos sem fees detalhados.
3. **Correção pontual** do registro do Thales: zerar `estimated_value` da linha correta via insert/update para destravar a exibição imediatamente.

### Parte B — Detecção e correção de duplicatas (somente admin)
1. **Nova página** `src/pages/AdminDuplicates.tsx`, acessível só para `admin`, listada no menu admin existente.
2. **Lógica de detecção** (client-side, sobre `usePatients()`):
   - Normalizar nome: `trim().toLowerCase().replace(/\s+/g,' ')`.
   - Agrupar e mostrar grupos com 2+ pacientes. Para cada grupo, exibir: nome original, procedimento, etapa, criado em, último contato, telefone, e‑mail, valor.
   - Indicador visual quando telefone OU e‑mail também coincide (alta confiança) vs apenas nome (média).
3. **Ações por grupo**:
   - **Manter este / Excluir os demais**: botão por linha que marca o "canônico" e deleta os outros usando o `useDeletePatient` existente (que já remove tasks/contacts/checklist/pending). Confirmação obrigatória.
   - **Ignorar grupo** (sessão apenas, sem persistência) — opcional, marca como revisado localmente.
4. **Prevenção de novas duplicatas no formulário** (`AddPatientForm.tsx`):
   - Ao digitar o nome (debounce 300 ms), procurar na lista atual pacientes com nome normalizado igual e mostrar um aviso amarelo abaixo do campo: "Já existe um paciente com este nome (etapa X). Deseja continuar?". Não bloqueia; apenas alerta.
   - `.trim()` aplicado ao nome antes de enviar para o banco, eliminando a causa raiz do caso do Thales (espaço à esquerda).

## Fora de escopo
- Merge de dados entre duplicatas (combinar histórico de contatos/tasks). Por ora apenas "manter um, excluir os outros".
- Constraint única no banco — nomes podem legitimamente coincidir entre pacientes diferentes; constraint causaria falsos positivos.

## Arquivos afetados
- `src/components/PatientCard.tsx` (cálculo do valor exibido)
- `src/components/PatientPanel.tsx` (limpar `estimated_value` ao salvar fees)
- `src/components/AddPatientForm.tsx` (trim + aviso de duplicata)
- `src/pages/AdminDuplicates.tsx` (novo)
- `src/App.tsx` + menu admin (rota nova)
- 1 update pontual em `patients` (zerar `estimated_value` do Thales)
