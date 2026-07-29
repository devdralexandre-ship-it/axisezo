## Problema

Ao unificar pacientes, o erro `duplicate key value violates unique constraint "preop_checklist_items_patient_id_item_key_key"` ocorre porque a função `merge_patients` faz `UPDATE ... SET patient_id = _keep` em `preop_checklist_items`, mas existe constraint única em `(patient_id, item_key)`. Se o paciente principal e o duplicado têm o mesmo `item_key`, o UPDATE colide.

O mesmo risco existe em outras tabelas com constraints únicas por paciente — no schema atual, `preop_checklist_items` é a única com esse padrão, mas vou tratar defensivamente.

## Correção

Migração alterando `public.merge_patients(_keep uuid, _remove uuid[])` para, **antes** dos UPDATEs de reatribuição:

1. **`preop_checklist_items`**: para cada `item_key` já presente no `_keep`, deletar as linhas correspondentes nos `_remove` (mantém o valor do principal, conforme regra "campos do principal não são sobrescritos"). Depois fazer o `UPDATE` normal das restantes.

2. Manter o restante da função inalterado (contact_records, patient_documents, patient_uploads, patient_sent_materials, pending_items, tasks, signature_audit_log, DELETE final dos pacientes).

Sem mudanças no frontend — a mensagem de erro já é exibida pelo `AdminDuplicates.tsx` via toast. Após a correção, a unificação do caso ALBERTO ABREU CABUS (6 itens de checklist no duplicado) deve concluir sem erro.

## Detalhes técnicos

```sql
CREATE OR REPLACE FUNCTION public.merge_patients(_keep uuid, _remove uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'only admin can merge patients';
  END IF;
  IF _keep IS NULL OR _remove IS NULL OR array_length(_remove,1) IS NULL THEN
    RAISE EXCEPTION 'invalid arguments';
  END IF;
  IF _keep = ANY(_remove) THEN
    RAISE EXCEPTION 'keep id cannot be in remove list';
  END IF;

  -- Dedupe preop_checklist_items: keep principal's row when item_key collides
  DELETE FROM public.preop_checklist_items
   WHERE patient_id = ANY(_remove)
     AND item_key IN (SELECT item_key FROM public.preop_checklist_items WHERE patient_id = _keep);

  UPDATE public.contact_records        SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.patient_documents      SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.patient_uploads        SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.patient_sent_materials SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.pending_items          SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.preop_checklist_items  SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.tasks                  SET patient_id = _keep WHERE patient_id = ANY(_remove);
  UPDATE public.signature_audit_log    SET patient_id = _keep WHERE patient_id = ANY(_remove);

  DELETE FROM public.patients WHERE id = ANY(_remove);
END;
$$;
```
