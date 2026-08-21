# Solicitação cirúrgica: OPME com fornecedores, código de prestador Cooperuro, equipamentos e duração

## O que muda no formulário

**1. OPME — até 3 fornecedores por item**
Cada item de OPME passa a ter, além de descrição e quantidade, até 3 campos de fornecedor (Fornecedor 1, 2 e 3), com autocompletar alimentado pelos fornecedores já usados antes. Os fornecedores aparecem no PDF junto ao item.

**2. Faturamento — código de prestador (Cooperuro)**
Quando a forma de faturamento for "Cooperuro", surge o campo "Código de prestador", preenchido automaticamente a partir do convênio do paciente conforme a tabela abaixo, sempre editável:

| Convênio | Código / identificação |
| --- | --- |
| Amil | 45418691 |
| ASFEB | CNPJ 05.027.686/0001-28 |
| Golden Cross | CNPJ 05.027.686/0001-28 |
| Seguros Unimed | 009990976023 |
| ASSEFAZ | CNPJ 05.027.686/0001-28 |
| GEAP | 4043758 |
| CAMED | CNPJ 05.027.686/0001-28 |
| Luminar (antiga FACHESF) | CNPJ 05.027.686/0001-28 |
| Unimed Central Nacional – CNU | 97510411 |

Observações exibidas como aviso ao lado do campo quando aplicável:
- Seguros Unimed: válido somente em Alagoinhas, Camaçari, Candeias, Catu, Ipiaú, Jequié, Lauro de Freitas, Salvador e Santo Amaro.
- Unimed CNU: exclusivamente no Hospital Mater Dei, carteiras iniciadas em 865 ou 067, além de intercâmbios com cobertura no Mater Dei.
- Convênio sem regra cadastrada: campo fica em branco para preenchimento manual.

**3. Novos campos**
- **Equipamentos**: lista de itens (descrição + quantidade) com autocompletar, no mesmo padrão de OPME.
- **Duração prevista do procedimento**: campo em minutos/horas, com sugestões dos valores já usados para o mesmo procedimento.

Ambos entram na seção "Procedimento" do PDF gerado.

**4. Memória de preenchimento**
Ao gerar a solicitação, tudo que foi preenchido (CBHPM principal e complementares, CID, OPME com fornecedores, equipamentos, duração e código de prestador) é gravado como sugestão vinculada ao procedimento, subindo na lista conforme o uso. Na próxima solicitação do mesmo procedimento, esses itens aparecem como sugestões e nos padrões salvos por cirurgião/concierge.

**5. Texto de abertura**
Quando o faturamento for "Custos Totais Particulares", o PDF passa a abrir com "Solicito orçamento para realização do procedimento abaixo:". Nos demais casos permanece "Solicito autorização para realização do procedimento abaixo:".

## Detalhes técnicos

- `src/data/documents.ts`: `OpmeItem` ganha `suppliers: string[]` (máx. 3); `SurgicalRequestData` ganha `equipment: OpmeItem[]`, `procedureDuration: string` e `providerCode: string`. `defaultSurgicalRequestData` inicializa os novos campos (com fallback para dados antigos sem eles) e `buildSurgicalRequestHtml` renderiza as novas seções e alterna a frase de abertura por `billingType`.
- Novo `src/data/providerCodes.ts` com o mapa convênio → código + observação, com correspondência por texto normalizado (`normalizeText`), tolerante a variações do nome do convênio.
- `src/components/SurgicalRequestForm.tsx`: campos de fornecedor por item de OPME, bloco de equipamentos, campo de duração, e campo condicional de código de prestador com autopreenchimento ao trocar convênio/faturamento (sem sobrescrever edição manual).
- `src/hooks/useCodeSuggestions.ts` / `src/components/CodeAutocomplete.tsx`: novos `kind` — `supplier`, `equipment`, `duration`, `provider_code` — reaproveitando a tabela existente de sugestões (nenhuma mudança de esquema é necessária; a coluna `kind` é texto).
- `src/components/GenerateDocumentDialog.tsx`: chamar `recordProcedureCodeSuggestions` na geração da solicitação cirúrgica com todas as entradas (hoje isso só acontece no cadastro do paciente), e incluir os novos campos ao salvar padrões por cirurgião/concierge (`useDefaultProcedureCodes`).
- Documentos antigos continuam abrindo normalmente: leitura defensiva dos campos ausentes.
