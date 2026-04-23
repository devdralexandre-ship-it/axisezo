

# Plano: Form estruturado para novo documento + logo no template

Hoje o "Novo documento" mostra o título, tipo, template usado e um textarea de HTML cru — exigindo que a secretária edite código. Vamos transformar em um **formulário inteligente**, com foco no caso de uso mais crítico (Solicitação Cirúrgica), preenchido automaticamente a partir do cadastro do paciente.

## 1. Novo modelo de dados estruturados por documento

Adicionar ao `patient_documents` uma coluna `data jsonb` que guarda os campos estruturados (CBHPM, CID, OPME, regime, etc.). O `body_html` continua sendo o snapshot final renderizado para o PDF — mas passa a ser **gerado a partir do `data`** no momento da criação, não escrito à mão.

Adicionar ao `document_templates`:
- `logo_path text` (path no bucket `patient-documents`, subpasta `template-logos/`)
- `default_data jsonb` (valores padrão para os campos estruturados — ex.: o template "Solicitação — Dr Estrela" pode pré-cadastrar texto padrão de descrição cirúrgica, regime padrão, etc.)

Adicionar ao `patients` (cadastro):
- Nada novo agora — todos os campos exibidos já existem (`procedure`, `surgicalApproach`, `laterality`, `surgeon`, `desiredHospital`, `payer`, `billingType`, `responsibleContact`, etc.)

## 2. Novo formulário "Novo documento" (Solicitação Cirúrgica)

Substituir o textarea de HTML por seções organizadas:

### Seção A — Dados do paciente (auto-preenchido, somente leitura com lápis para editar)
- Nome, idade, telefone, responsável, convênio, hospital desejado → vêm do paciente; clicar no lápis permite override só para esse documento.

### Seção B — Procedimento (auto-preenchido + sugestões)
- **Procedimento principal** (texto, pré-preenchido com `patient.procedure` + via + lateralidade)
- **Código CBHPM principal** (input com autocomplete; sugestões vindas de uma tabela `procedure_code_suggestions` que aprende com o uso — ver seção 4)
- **Procedimentos complementares** (lista dinâmica: "+ adicionar"; cada linha = descrição + código CBHPM)
- **CID** (autocomplete, sugestões aprendidas)
- **Lista de OPME** (lista dinâmica de itens; cada linha = descrição + quantidade; sugestões aprendidas)
- **Descrição cirúrgica** (textarea, plenamente editável; pré-preenchida com texto padrão do template — se houver — análogo ao "código cirúrgico solicitado")

### Seção C — Regime e reservas
- **Regime de internação**: radio `Hospitalar` / `Hospital-dia`
- **Reserva de UTI**: switch sim/não
- **Reserva de sangue**: switch sim/não (se sim, abre campo de unidades)

### Seção D — Faturamento
- **Forma de faturamento**: select pré-selecionado com `patient.billingType` (Cooperuro / Unicooper / Honorários Particulares / Custos Totais Particulares); editável só para esse documento.

### Seção E — Preview e geração
- Painel lateral (ou aba) "Preview" mostra o PDF renderizado a partir dos campos acima, em tempo real.
- Botão "Gerar PDF" salva o `data` estruturado, gera o `body_html` final via um renderer dedicado (`buildSurgicalRequestHtml(data, patient)`), e cria o PDF.

### Para os outros tipos (Orçamento, Atestado, Relatório)
- Manter o fluxo atual (template + variáveis) por enquanto. O novo formulário estruturado é só para **Solicitação Cirúrgica**, onde a complexidade justifica.
- Marcar visualmente no diálogo que orçamento/atestado/relatório usam o modo simples; só `surgical_request` abre o formulário rico.

## 3. Logo no cabeçalho do template

Na página `/templates`:
- Adicionar campo "Logo (PNG/JPG, máx 1MB)" com upload para `patient-documents/template-logos/{template_id}.png`.
- Salvar `logo_path` no template.
- Preview da logo atual com botão "Remover".

No PDF gerado:
- Atualizar `src/lib/pdf-generator.tsx` para aceitar `logoUrl?: string` e renderizar `<Image src={logoUrl} />` no topo do `<View style={styles.header}>`, alinhada à esquerda do texto do cabeçalho.
- `useGenerateDocument` busca uma signed URL da logo do template antes de chamar `renderDocumentToBlob`.

## 4. Aprendizado de sugestões (CBHPM, CID, OPME)

Tabela nova `procedure_code_suggestions`:
```
procedure text          -- procedimento canônico (ex.: "Prostatectomia Radical")
kind text               -- 'cbhpm' | 'cid' | 'opme'
value text              -- código ou nome do item
label text              -- descrição amigável
usage_count int         -- incrementa a cada uso
last_used_at timestamptz
```

- Ao gerar um documento, para cada código/OPME usado, fazer upsert incrementando `usage_count`.
- Os autocompletes filtram por `procedure = patient.procedure` e ordenam por `usage_count desc`.
- Resultado: a primeira solicitação cirúrgica de "Prostatectomia Radical" não tem sugestões; a partir da segunda, os códigos e OPME mais usados começam a aparecer no topo. Sem necessidade de "rodada de treinamento" — o sistema aprende do uso real.
- Opcional (rápido de adicionar depois): seed inicial manual via página `/library` ou import CSV.

## 5. Renderização HTML estruturada (Solicitação Cirúrgica)

Nova função `src/data/documents.ts → buildSurgicalRequestHtml(data, patient)`:
- Constrói HTML semântico (mesmas tags que o `pdf-generator` já entende: `<p>`, `<h3>`, `<ul><li>`, `<strong>`) a partir dos campos estruturados.
- Layout: Identificação → Procedimento e códigos → CID → OPME → Descrição cirúrgica → Regime/reservas → Faturamento → Data/assinatura.
- Usado tanto no preview live quanto na geração final.

## Arquivos afetados

- **Migração**: adicionar colunas (`patient_documents.data`, `document_templates.logo_path`, `document_templates.default_data`) + criar tabela `procedure_code_suggestions` com RLS authenticated.
- **`src/data/documents.ts`**: tipos `SurgicalRequestData`, função `buildSurgicalRequestHtml`, defaults.
- **`src/components/GenerateDocumentDialog.tsx`**: reescrita — formulário estruturado para `surgical_request`, modo simples para os outros tipos.
- **Novo `src/components/SurgicalRequestForm.tsx`**: as seções A-D + preview live.
- **Novo `src/components/CodeAutocomplete.tsx`**: input genérico de autocomplete com sugestões da `procedure_code_suggestions` (usado para CBHPM, CID, OPME).
- **`src/hooks/useDocuments.ts`**: aceitar `data` estruturado; ao gerar, chamar `buildSurgicalRequestHtml`; gravar `data` no insert; upsert em `procedure_code_suggestions`.
- **`src/pages/Templates.tsx`**: upload de logo, campo `default_data` (textarea simples por enquanto: descrição cirúrgica padrão + regime padrão).
- **`src/lib/pdf-generator.tsx`**: suportar `logoUrl` no header.

## Verificação

1. Abrir paciente → Novo documento → Solicitação Cirúrgica → seções A-D vêm pré-preenchidas com dados do cadastro; preview à direita atualiza ao digitar.
2. Adicionar 1 código CBHPM, 1 CID, 2 OPMEs → gerar PDF → reabrir o mesmo paciente (ou outro com mesmo procedimento) → os mesmos códigos aparecem no topo do autocomplete.
3. Marcar regime "Hospital-dia" + UTI sim + Sangue 2 unidades → aparecem no PDF.
4. Em `/templates`, fazer upload da logo da clínica no template "Solicitação — Dr Estrela" → gerar nova solicitação para um paciente do Dr Estrela → logo aparece no topo do PDF.
5. Outros tipos (orçamento, atestado, relatório) continuam funcionando no modo atual.

## Limitações

- Sem tabela CBHPM oficial pré-carregada: a secretária digita o código manualmente na primeira vez de cada combinação. A partir daí, autocomplete acelera. Se quiser, em iteração futura, dá pra importar a tabela CBHPM da AMB (CSV ~5000 linhas) como seed.
- Preview live é HTML simples (não o PDF real renderizado em iframe) por performance — fiel ao layout final, mas com fontes do navegador. O PDF gerado usa Helvetica.
- Logo precisa estar acessível por URL pública temporária (signed URL); aumenta levemente o tempo de geração do PDF (busca + download da logo).

