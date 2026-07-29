## Objetivo

Em `AdminDuplicates`, adicionar ação **"Unificar no principal"** que reatribui todos os dados relacionados de registros duplicados para um paciente escolhido como principal e depois exclui os duplicados. Os campos do paciente principal permanecem inalterados.

## Fluxo de UI

Em `src/pages/AdminDuplicates.tsx`, no card de cada grupo:

1. Adicionar um botão **"Manter este"** (ou radio) por linha para escolher o principal.
2. Um botão **"Unificar no principal"** no header do card abre um dialog de prévia.
3. Prévia mostra:
   - Registro principal (nome, procedimento, estágio, cirurgião, telefone, e-mail).
   - Lista de duplicados que serão excluídos.
   - Contadores do que será reatribuído: documentos, uploads, tarefas, contatos, ações pendentes, checklist pré-op, materiais enviados.
   - Aviso: "Campos do paciente principal serão mantidos. Nenhum valor será sobrescrito."
4. Confirmar dispara a operação; sucesso mostra toast e refetch das queries.

## Backend

Criar migration com função `SECURITY DEFINER`:

```sql
CREATE OR REPLACE FUNCTION public.merge_patients(_keep uuid, _remove uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Só admin pode unificar
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'only admin can merge patients';
  END IF;
  IF _keep = ANY(_remove) THEN
    RAISE EXCEPTION 'keep id cannot be in remove list';
  END IF;

  -- Reatribuir todas as tabelas com patient_id
  UPDATE public.contact_records         SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.patient_documents       SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.patient_uploads         SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.patient_sent_materials  SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.pending_items           SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.preop_checklist_items   SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.tasks                   SET patient_id = _keep WHERE patient_id = ANY(_remove);

  -- signature_audit_log e signature_verifications guardam patient_id só como snapshot histórico:
  -- manter aponta para o duplicado excluído quebraria FK se houvesse; hoje são apenas colunas
  -- informativas sem FK, então reatribuímos também por consistência de consulta.
  UPDATE public.signature_audit_log     SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.signature_verifications SET document_id = document_id WHERE false; -- no-op, mantido para leitura

  -- Excluir duplicados (patients já tem cascade nas tabelas próprias, mas aqui já esvaziamos)
  DELETE FROM public.patients WHERE id = ANY(_remove);
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_patients(uuid, uuid[]) TO authenticated;
```

## Frontend

- Novo hook `useMergePatients` em `src/hooks/usePatients.ts` que chama `supabase.rpc('merge_patients', { _keep, _remove })` e invalida as queries de pacientes, documentos, tarefas, uploads.
- Novo componente inline `MergePreviewDialog` dentro de `AdminDuplicates.tsx` (ou extraído se passar de ~80 linhas). Busca contagens via `supabase.from('<tabela>').select('id', { count: 'exact', head: true }).in('patient_id', removeIds)` em paralelo para as 7 tabelas.
- Estado local por grupo: `keepId: string | null`. Botão "Unificar" fica desabilitado até escolher o principal.
- Após sucesso, o grupo some naturalmente (só sobra 1 registro com aquele nome).

## Detalhes técnicos

- Somente admin acessa a página, e a função também valida `admin` no server.
- Não há alteração de RLS nas tabelas envolvidas — o `UPDATE`/`DELETE` roda como `SECURITY DEFINER`.
- Nenhuma mudança nos formulários de paciente, Kanban ou relatórios.

## Fora de escopo

- Merge campo a campo (rejeitado — mantemos campos do principal).
- Undo/histórico de merges — irreversível, coberto pela prévia obrigatória.
