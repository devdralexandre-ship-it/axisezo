# Notas da concierge (com autor e data)

Um mural de recados dentro da ficha do paciente. Cada nota registra automaticamente quem escreveu e quando, e fica permanente — ninguém apaga.

## Como vai funcionar

- Nova seção **"Notas da concierge"** no painel do paciente, logo abaixo de Observações.
- Campo de texto + botão **Adicionar nota**. Ao salvar, a nota aparece no topo da lista com:
  - nome de quem escreveu (nome do perfil: concierge, cirurgião ou admin),
  - data e hora (ex.: `18/08/2026 · 19:02`),
  - o texto da nota.
- Cada nota pode ser marcada como **"Para o cirurgião"** (uma caixinha ao escrever). Notas assim ganham um selo visível para destacar que pedem atenção médica.
- **Editar:** o próprio autor pode corrigir a nota nas primeiras 2 horas; depois disso ela fica travada. Nota editada mostra "editada em ...".
- **Apagar:** ninguém apaga, nem admin. O histórico é registro permanente.
- Notas são visíveis para todos que já enxergam aquele paciente (mesma regra de acesso do restante da ficha).

## Onde as notas aparecem além do painel

- **Card do Kanban:** ícone discreto de balão com a contagem de notas, quando houver ao menos uma. Passar o mouse mostra a nota mais recente.
- **Tela de pendências:** mesma indicação de balão, para a concierge ver rapidamente onde há recado.

## Fora deste escopo (por enquanto)

O histórico automático de mudanças (ação concluída por quem, mudança de coluna, alteração de honorários, preenchimento de alerta) não entra agora. Fica registrado como próximo passo natural — as notas manuais já cobrem o recado do dia a dia, e o histórico automático é um trabalho maior de rastreio no banco.

## Detalhes técnicos

**Banco** — nova tabela `patient_notes`:

| campo | conteúdo |
|---|---|
| `patient_id` | paciente relacionado |
| `body` | texto da nota |
| `author_user_id` | preenchido com o usuário autenticado |
| `author_name` | cópia do nome no momento da escrita (não muda se o perfil mudar depois) |
| `for_surgeon` | marcação "para o cirurgião" |
| `edited_at` | preenchido quando o autor corrige |
| `created_at` / `updated_at` | padrão |

Regras de acesso (RLS + GRANT na mesma migração):
- Leitura: quem já pode acessar o paciente, via a função existente `can_access_patient`.
- Criação: mesma regra, e `author_user_id` obrigatoriamente igual ao usuário logado.
- Edição: só o autor, e só dentro de 2 horas — validado por gatilho (não por CHECK), que também preenche `edited_at` e impede troca de autor/paciente.
- Remoção: nenhuma política de exclusão, nem para admin.
- Índice em `(patient_id, created_at desc)`.

**Frontend**
- `src/hooks/usePatientNotes.ts`: busca por paciente (`['patient-notes', patientId]`), mutações de criar e editar, com atualização otimista para o efeito ser imediato sem recarregar a tela.
- `src/components/PatientNotes.tsx`: lista + formulário, seguindo a densidade visual atual (IBM Plex Sans, blocos compactos).
- `src/components/PatientPanel.tsx`: monta a seção nova; o rascunho é descartado ao fechar o painel, como nas demais telas.
- Contagem no card: `src/hooks/usePatients.ts` passa a trazer só a contagem agregada de notas junto da consulta do Kanban (barato, não traz o texto), consumida por `PatientCard.tsx` e pela tela de pendências.
