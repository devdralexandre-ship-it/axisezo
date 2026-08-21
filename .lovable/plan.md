# Corrigir caixa de "Alertas" vazia no painel do paciente

## O que está acontecendo

Verifiquei o registro do Albertino Melo de Souza no banco:

- **Observações foi salvo corretamente**: o texto `75 99228-4542 (Lana)` está gravado (atualizado hoje 14:23 Bahia). No segundo print a seção "Observações" fica logo abaixo do bloco Financeiro, fora do recorte da imagem — ou seja, o dado está lá.
- **Alertas ficou com uma quebra de linha invisível**: o campo não está vazio, contém 1 caractere de espaço/enter. Como o painel só testa "tem conteúdo?" e não "tem conteúdo visível?", a caixa vermelha de Alertas continua sendo exibida sem texto.

## O que vou fazer

1. **Ao salvar a edição do paciente**: aparar espaços/quebras de linha dos campos de texto (Alertas, Observações e demais textos livres). Campos que ficarem só com espaço passam a ser gravados como vazio de verdade.
2. **Na exibição**: só mostrar a caixa vermelha de Alertas quando houver texto visível — nada de caixa vazia.
3. **Limpeza pontual no banco**: zerar os campos Alertas (e Observações) que hoje contêm apenas espaços/quebras de linha, para que nenhum paciente antigo siga mostrando o alerta fantasma.
4. Aplicar a mesma limpeza de espaços no formulário de cadastro de novo paciente, para não recriar o problema.

## Detalhes técnicos

- `src/components/PatientPanel.tsx`: em `saveEditing`, fazer `trim()` nos valores string antes da conversão `'' → null`; na renderização, trocar `patient.alerts &&` por checagem de `patient.alerts?.trim()` (e usar o valor aparado no texto).
- `src/components/AddPatientForm.tsx`: `alerts`/`notes` enviados com `trim() || null`.
- Migração de dados (UPDATE): `alerts`/`notes` → `NULL` onde `btrim(campo) = ''`.

Sem mudança de esquema, permissões ou regras de negócio.
