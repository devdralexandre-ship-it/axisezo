# Agente de onboarding dentro do Axis

Um assistente de dúvidas de uso, acessível de qualquer tela do app por um botão de ajuda. Responde só sobre como usar o Axis, a partir de um manual mantido junto com o projeto. Não consulta dados de pacientes.

## Como o usuário vai usar

- Botão flutuante "Ajuda" (ícone de interrogação) no canto inferior direito, presente nas telas internas (Kanban, Pendências, Relatórios, Paciente).
- Ao clicar, abre um painel de conversa lateral (bottom-sheet no celular).
- Sugestões prontas ao abrir, ex.: "Como cadastro um paciente?", "O que é tolerância de uma ação?", "Quem enxerga quais pacientes?", "Como anexo um orçamento?".
- Respostas em streaming (aparecem enquanto são escritas), com formatação (listas, negrito).
- Conversa mantida apenas durante a sessão do navegador, com botão "Nova conversa". Sem histórico salvo no banco.
- Só usuários logados: o botão não aparece na tela de login e o servidor recusa chamadas sem sessão válida.

## O que o agente sabe

Um manual de uso versionado no projeto, escrito a partir do comportamento real do app:

- Papéis e escopo: admin, cirurgião, concierge, call center, estagiário; escopo por cirurgião; capacidades por usuário.
- Pipeline: as 12 colunas, o que significa cada uma, "Potencial de indicação" fora das métricas, data de cirurgia ao mover para "Cirurgia agendada", motivo obrigatório ao marcar como perdido.
- Ações: título com autocomplete, responsável, prazo, tolerância, limites por tipo de ação e justificativa de extensão, escalonamento 24h após a tolerância.
- Pacientes: campos do cadastro, idade em meses, tipo de faturamento, múltiplos hospitais desejados, marcadores (sensível, altíssimo risco, alto ticket), badge "Novo".
- Anexos e documentos: upload, categorias, geração de PDF, assinatura.
- Notas da concierge: janela de edição de 2h, marcação "para cirurgião".
- Telas: Kanban, Planilha, Pendências, Relatórios (data de indicação como filtro, SLA de 24h do orçamento), Usuários, Duplicados, Tipos de ação.
- Regras de conduta: responde só sobre uso do Axis; se perguntarem dados de paciente, orienta a usar o app; se não souber, diz que não sabe e sugere falar com o admin.

O manual fica em um arquivo do projeto, então evolui junto com o produto — sem precisar retreinar nada.

## Escopo desta rodada

Inclui: botão de ajuda, painel de conversa, função de servidor com IA, manual inicial, tratamento de erros (limite de uso/creditos, falha de rede) exibido na própria conversa.

Não inclui: bot do Telegram, histórico salvo, acesso a dados de pacientes, tour guiado passo a passo na interface.

## Detalhes técnicos

- Manual: `src/data/axis-manual.ts` exportando o texto (markdown) usado como base do system prompt. Fonte única, sem chamada extra ao banco.
- Edge function `supabase/functions/axis-help/index.ts`: valida o JWT do usuário em código (`auth.getUser(token)`), monta `system` = regras + manual, recebe o histórico da conversa e faz streaming com Lovable AI (`google/gemini-3.7-flash`) via AI SDK/gateway. CORS em todas as respostas, inclusive erros. Sem `SUPABASE_SERVICE_ROLE_KEY` (não acessa tabelas).
- Erros do gateway repassados com status: 429/5xx com aviso de "tente novamente"; 402/403 com mensagem clara para o admin. Nunca resposta genérica silenciosa.
- Frontend: `src/components/HelpAgent.tsx` (painel + composer, textarea com foco automático, render markdown com `react-markdown` já usável no projeto) e `src/components/HelpAgentButton.tsx` (FAB). Montados uma vez em `src/App.tsx` dentro das rotas protegidas, escondidos em `/auth`, `/reset-password` e `/verify-document/:id`.
- Estado da conversa em `useState` no componente (sem persistência); leitura do streaming via `fetch` para a URL da função construída com `import.meta.env.VITE_SUPABASE_PROJECT_ID` e `Authorization` da sessão atual.
- Verificação: abrir o painel logado, enviar 3 perguntas (uma de escopo/permissões, uma de tolerância de ação, uma fora de escopo) e confirmar respostas coerentes, streaming e mensagem de recusa educada; conferir logs da função sem erro.
