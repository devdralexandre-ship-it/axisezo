# Manual completo do Axis para o agente de ajuda

## Por que o agente recusou a pergunta sobre certificado

O agente responde apenas com base no manual versionado no projeto e é instruído a dizer que não sabe quando o assunto não está lá — para não inventar telas e botões. O manual atual tem uma linha só sobre assinatura, embora o app já tenha envio de certificado A1, modos de delegação, histórico de uso e verificação pública. A recusa foi correta; a base de conhecimento é que está incompleta.

## O que será feito

Reescrever o manual como documentação completa do produto, a partir de uma varredura de todo o código (telas, formulários, regras de banco, funções de servidor), para que o agente responda qualquer dúvida sobre o que já existe — incluindo segurança de dados.

### Levantamento antes de escrever

Varredura de: todas as páginas (Kanban, Planilha, Pendências, Relatórios, Biblioteca, Modelos, Perfil, MFA, Usuários, Duplicados, Tipos de ação, Verificação de documento, Autenticação/redefinição de senha), todos os formulários e diálogos do paciente, os hooks de dados, as funções de servidor e as regras de acesso do banco. O manual descreve o comportamento real verificado, não o pretendido.

### Seções do novo manual

1. **O que é o Axis** e o ciclo de vida do paciente.
2. **Acesso e conta**: login, redefinição de senha, ausência de cadastro público, autenticação em dois fatores, usuário inativo.
3. **Papéis, escopo e capacidades**: admin, cirurgião, concierge, call center, estagiário; escopo por cirurgião; "apenas atribuídos"; cada capacidade e o que ela libera; por que "não vejo um paciente" quase sempre é escopo/nome operacional.
4. **Pipeline**: as 12 colunas com significado, arrastar no desktop e no celular, data da cirurgia ao agendar, motivo obrigatório ao perder, "Potencial de indicação" fora das métricas.
5. **Cadastro e ficha do paciente**: cada campo, idade em anos/meses, procedimento com busca, lateralidade e via de acesso condicionais, convênio/particular, tipo de faturamento, múltiplos hospitais, campos financeiros e valor estimado, marcadores e selo "Novo", aviso de possível duplicidade.
6. **Ações e prazos**: título com autocomplete, responsável padrão, prazo, tolerância, limite por tipo de ação e justificativa, escalonamento em 24h, badges de status, obrigatoriedade do próximo passo.
7. **Anexos**: categorias, envio, confirmação visual, miniatura, visualizar/baixar/remover, comportamento no celular.
8. **Documentos**: tipos, modelos, geração de PDF, dados que entram no documento, envio ao paciente.
9. **Assinatura digital e certificado A1**: envio do .pfx com senha no Perfil, senha criptografada no servidor, certificado expirado, revogação, os três modos de delegação e o que cada um permite, autorização por documento pelo cirurgião, histórico de uso, página pública de verificação do documento.
10. **Notas da concierge**: autoria e data, "para cirurgião", edição só nas 2 primeiras horas, sem exclusão.
11. **Checklist pré-operatório e pendências do paciente**.
12. **Biblioteca de materiais e pacotes**: criar, organizar por fase/procedimento, registrar envio ao paciente.
13. **Pendências (tela)**: o que entra na lista, edição inline, abrir a ficha do paciente.
14. **Relatórios**: filtros combináveis, data de indicação como referência, conversão particular e convênio, SLA de 24h do primeiro orçamento, exclusão de "Potencial de indicação", exportação CSV, comportamento para quem não vê valores.
15. **Importação CSV**: formato, mapeamento, normalização de status, atribuição padrão.
16. **Telas administrativas**: Usuários, Duplicados (detecção e unificação), Tipos de ação.
17. **Segurança e privacidade dos dados** (seção dedicada):
    - o controle de acesso é aplicado no servidor, não na tela — a interface não consegue liberar o que o servidor nega;
    - o que cada papel enxerga e por que valores financeiros são ocultos para alguns usuários;
    - arquivos e documentos ficam em armazenamento privado, acessíveis por link temporário apenas a quem tem acesso ao paciente;
    - senha do certificado digital fica criptografada no servidor; assinaturas geram registro de auditoria imutável;
    - notas não podem ser apagadas; histórico preservado;
    - 2FA disponível e recomendada; senhas vazadas publicamente são rejeitadas;
    - o app não é indexado por buscadores;
    - **boas práticas obrigatórias do usuário**: não compartilhar conta ou senha, não enviar dados de paciente por canais externos (grupos, e-mail pessoal, IA de terceiros), não tirar prints com dados para uso fora do app, sair da sessão em computador compartilhado, avisar o admin sobre desligamento de colaborador;
    - o próprio agente de ajuda **não tem acesso a dados de paciente** e nunca deve ser usado para consultá-los.
18. **Solução de problemas** e **glossário** (tolerância, escalonamento, SLA, delegação, escopo, capacidade).

### Ajustes no comportamento do agente

- Regras reforçadas: nunca pedir nem repetir dados de paciente, senha, token ou senha de certificado; se o usuário colar esse tipo de conteúdo, orientar a não fazê-lo e seguir sem repetir o dado.
- Ao responder sobre segurança, reforçar sempre o princípio de não expor dados fora do app.
- Recusa mais útil: quando o assunto realmente não estiver no manual, indicar a tela mais provável e sugerir avisar o admin de que falta documentação.
- Permitir respostas um pouco mais longas quando a pergunta for de procedimento com vários passos.

Sem mudança de interface: botão de ajuda e painel continuam iguais.

## Detalhes técnicos

- Reescrita de `supabase/functions/axis-help/manual.ts` (template literal, backticks escapados); se o texto ficar grande, divisão em módulos por tema no mesmo diretório da função, concatenados no prompt.
- Ajuste do bloco de regras e do limite de tamanho de resposta em `supabase/functions/axis-help/index.ts`.
- Redeploy da função `axis-help`.
- Verificação: bateria de perguntas na própria função cobrindo certificado/delegação, 2FA, CSV, biblioteca, relatórios/SLA, escopo de acesso, segurança de dados, uma tentativa de obter dado de paciente e uma pergunta fora de escopo — confirmando respostas corretas, recusa adequada e nenhum vazamento.
