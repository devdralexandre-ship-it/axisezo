## Diagnóstico

Levantei o fluxo no código e identifiquei três causas distintas para o que o João descreve:

1. **Kanban não atualiza após incluir / excluir** — hoje só dependemos do `invalidateQueries(['patients'])` que dispara um refetch após a mutação local. Ele funciona, mas (a) não cobre quando outro usuário faz a mudança e (b) se o pós-processamento da inclusão trava (item 2 abaixo), o `invalidate` nunca chega a rodar.

2. **Janela "Novo paciente" não fecha e botão "Criar paciente" fica girando** — o `handleSubmit` faz `await onAdd(...)` (o paciente é criado e o toast "Paciente adicionado!" dispara aqui) e **depois** percorre `pendingUploads` em série, fazendo upload de cada anexo antes de chamar `onClose()`. Se um arquivo trava ou demora (ex.: foto grande, HEIC, falha de RLS, conexão instável), o `setSubmitting(false)` e o `onClose()` ficam pendurados — daí a sensação de "incluiu mas não fechou".

3. **Foto não carrega (novo paciente e card)** — no `useUploadPatientFile` qualquer erro do storage é convertido em um toast genérico (`e?.message`). Erros como HEIC, MIME vazio, falha de RLS ou tamanho excessivo aparecem todos como erro silencioso/genérico, então não dá para saber o motivo real. PDFs funcionam porque caem no caminho "feliz" (MIME `application/pdf`, tamanho moderado).

## O que vou fazer

### 1. Realtime no Kanban (todos os usuários)
- Migration: incluir `public.patients`, `public.tasks`, `public.contact_records`, `public.preop_checklist_items`, `public.pending_items`, `public.patient_uploads`, `public.patient_documents` na publication `supabase_realtime` e marcar `REPLICA IDENTITY FULL` onde precisarem.
- Criar `src/hooks/useRealtimePatients.ts` que abre um canal `postgres_changes` para essas tabelas e chama `queryClient.invalidateQueries({ queryKey: ['patients'] })` em qualquer `INSERT/UPDATE/DELETE`. RLS já restringe os eventos recebidos por usuário.
- Plugar o hook no `PipelineDashboard` (uma única subscription para toda a tela).

### 2. Fechar o dialog imediatamente e mover uploads para segundo plano
- No `AddPatientForm.handleSubmit`:
  - Assim que o `await onAdd(...)` resolver (paciente criado), chamar `resetForm()` + `onClose()` + `setSubmitting(false)` **antes** de iniciar os uploads.
  - Disparar os uploads pendentes em segundo plano (`uploadPatientFile` por arquivo) com `Promise.allSettled`, mostrando um toast de progresso e toasts individuais de sucesso/erro por arquivo. O Kanban já vai mostrar o paciente novo (pelo Realtime + invalidate), e os anexos aparecem no card conforme terminam.
  - Garantir `try/finally` blindado para que o botão nunca fique girando mesmo se algo lançar.

### 3. Upload de imagens — diagnóstico real + bloqueio claro de HEIC
- Em `src/hooks/usePatientUploads.ts` (`uploadPatientFile`):
  - Detectar arquivos `image/heic` / `image/heif` / extensões `.heic` / `.heif` e rejeitar com mensagem explícita ("Fotos do iPhone em HEIC não são suportadas. No iPhone: Ajustes → Câmera → Formatos → Mais Compatível, ou envie como JPEG.").
  - Fazer fallback de `contentType` para `image/jpeg` quando `file.type` vier vazio mas a extensão for `.jpg`/`.jpeg`/`.png`/`.webp` (alguns iPhones / câmeras enviam type vazio).
  - Quando `supabase.storage.upload` retornar erro, propagar `error.message`, `error.statusCode` e `error.error` no toast (ex.: `Falha ao enviar "foto.jpg": new row violates row-level security policy (403)`), para que o João consiga me dizer o motivo exato caso ainda falhe.
  - Mesmo tratamento no `PatientUploads.handleFiles` (card do paciente).
- O input continua aceitando `image/*` + PDF — só damos uma mensagem clara quando o formato não é suportado pelo storage/visualização.

### 4. Exclusão de paciente
Sem mudança de fluxo: o `DeletePatientDialog` já fecha (`setDeleteDialogOpen(false)`) e o `useDeletePatient` faz `invalidateQueries`. Com o Realtime do item 1, a coluna do Kanban também se atualiza para os outros usuários sem refresh.

## Detalhes técnicos

```text
PipelineDashboard
  └─ useRealtimePatients()           // novo hook
        └─ supabase.channel('kanban')
              .on('postgres_changes', { schema:'public', table:'patients' }, invalidate)
              .on('postgres_changes', { schema:'public', table:'tasks' }, invalidate)
              ...
              .subscribe()

AddPatientForm.handleSubmit
  1. await addPatientMutation       // cria paciente + checklist + tasks
  2. resetForm(); onClose(); setSubmitting(false)
  3. fire-and-forget: Promise.allSettled(pendingUploads.map(uploadPatientFile))
        → toast por arquivo, Realtime atualiza o card automaticamente
```

Migration (resumo):
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.preop_checklist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_uploads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_documents;
ALTER TABLE public.patients REPLICA IDENTITY FULL;
-- (idem para as outras, ignorando as já presentes)
```

## Arquivos afetados
- `supabase/migrations/<novo>.sql` — Realtime publication + replica identity
- `src/hooks/useRealtimePatients.ts` — **novo**
- `src/components/PipelineDashboard.tsx` — chamar o hook
- `src/components/AddPatientForm.tsx` — fechar dialog antes dos uploads, uploads em background
- `src/hooks/usePatientUploads.ts` — bloqueio HEIC, fallback de MIME, mensagens de erro detalhadas
- `src/components/PatientUploads.tsx` — herda o tratamento melhor de erro

## Fora de escopo
- Conversão automática HEIC→JPEG no browser (custosa, exige lib pesada). Vamos só orientar o usuário.
- Mudanças no fluxo de exclusão além do Realtime.