## Edição inline na revisão da importação CSV

Hoje o `CsvImporter.tsx` mostra os registros na etapa "Revisar Importação" apenas em modo leitura, com checkbox para incluir/excluir. Vou adicionar a possibilidade de editar cada linha antes de confirmar o lançamento no CRM, com foco em corrigir ambiguidades (procedimento desconhecido, convênio desconhecido, hospital inconsistente, status desconhecido) e campos faltantes (principalmente nome).

### Comportamento

1. Cada cartão de paciente na lista de revisão ganha um botão "Editar" (ícone de lápis) no canto superior direito.
2. Ao clicar, o cartão expande inline (sem abrir modal — mantemos o fluxo dentro do mesmo Dialog) revelando um formulário compacto com os campos:
   - Nome do paciente (text)
   - Telefone (text)
   - Procedimento (Select com `PROCEDURES` + opção "Outro" que libera campo livre, preservando o texto original quando vier do CSV)
   - Origem / Indicação (text)
   - Convênio (Select com `PAYERS`)
   - Hospital desejado (text — com sugestões dos hospitais já vistos no CSV via `<datalist>`)
   - Estágio do pipeline (Select com `STAGE_LABELS`)
   - Notas (textarea pequena)
3. Ao salvar, o cartão é re-validado: os warnings que foram corrigidos somem automaticamente. Por exemplo, se o usuário escolheu um convênio da lista, o warning `unknown_payer` desaparece. Se preencheu o nome, o warning `missing_name` some e o checkbox vira selecionável.
4. "Cancelar edição" descarta as mudanças locais daquela linha (alinhado com a regra do projeto de descartar drafts).
5. Botão "Importar N paciente(s)" continua só habilitado para linhas com nome preenchido e marcadas.

### Detalhes técnicos

- Arquivo único alterado: `src/components/CsvImporter.tsx`.
- Adicionar estado `editingIndex: number | null` e função `updateRow(index, partial)` que aplica o patch em `rows[index].mapped` e re-roda a parte de geração de warnings (extrair a lógica de validação de `mapRow` para uma função `computeWarnings(mapped, existingSet, knownHospitals)` reutilizável tanto no parse inicial quanto na re-validação após edição).
- Manter os warnings de `duplicate` (não some ao editar — usuário precisa decidir manualmente desmarcar) e de `inconsistent_hospital` (recalcula contra o mapa de hospitais já vistos).
- Se o usuário trocar o nome para um valor que continua duplicado, recalcular o warning.
- Layout do form: grid de 2 colunas em telas largas, 1 coluna no viewport mobile (atual viewport do usuário é 736px). Manter altura da `ScrollArea` em 400px — o form expandido aumenta a altura do cartão, ScrollArea cuida do overflow.
- Não alterar o contrato de `onImport` — os dados editados já fluem pelo mesmo `mapped` que vai para o payload final.
- Sem mudanças de banco, RLS, hooks ou tipos.

### Fora de escopo

- Edição em massa (bulk edit) — apenas linha a linha.
- Edição do cirurgião por linha — segue o `defaultSurgeon` global da etapa de upload (mantém comportamento atual; pode ser adicionado depois se necessário).
- Persistência do rascunho de edição entre fechamentos do dialog — ao fechar, tudo é descartado (consistente com a regra de drafts do projeto).
