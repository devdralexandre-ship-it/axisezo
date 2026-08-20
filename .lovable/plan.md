# Novos usuários, escopo por cirurgião e marca Axis

## 1. O sistema está pronto para os novos usuários?

Parcialmente. O que já funciona: criação de contas pelo painel Usuários, papéis (admin/cirurgião/concierge) e regras de acesso no banco.

O que falta hoje (verificado no banco e no código):

- **Concierge sempre vê todos os pacientes.** A regra atual dá "escopo amplo" a qualquer concierge, independentemente do cirurgião. Não existe hoje como limitar uma concierge a um único cirurgião (a única restrição existente, "apenas atribuídos", limita paciente a paciente e não cobre pacientes novos do cirurgião dela).
- **Cirurgião já fica restrito** aos pacientes onde `cirurgião = seu nome` — isso está correto e não muda. Admin continua vendo tudo.
- **As listas de cirurgiões e concierges estão fixas no código** (3 cirurgiões, 2 concierges). Sem alteração, o novo cirurgião e a nova concierge não aparecem nos formulários de paciente, filtros e responsáveis de ação.

## 2. Escopo por cirurgião (o que será feito)

Novo campo no perfil do usuário: **"Cirurgiões que este usuário enxerga"** (lista, editável em Usuários pelo admin).

Regra:

- Lista **vazia** = comportamento atual (Margô e Íris continuam vendo todos os pacientes).
- Lista **preenchida** = o usuário só enxerga pacientes cujo cirurgião está na lista. A nova concierge terá apenas o cirurgião dela.
- Admin ignora a regra (acesso pleno).
- Cirurgião continua restrito ao próprio nome.

A restrição é aplicada **no banco** (regras de acesso), não só na tela: vale para pacientes, ações, notas, documentos e anexos, já que todos passam pelas mesmas funções de acesso.

Também será ajustado o cadastro: a concierge restrita só poderá criar paciente para um cirurgião permitido.

## 3. Listas de cirurgiões e concierges dinâmicas

As opções de cirurgião/concierge nos formulários e filtros passarão a vir dos perfis ativos cadastrados, com as atuais como base. Assim, ao criar o novo cirurgião e a nova concierge em Usuários (com nome operacional preenchido), eles aparecem automaticamente em toda a aplicação — sem depender de alteração de código a cada novo usuário.

## 4. Marca: EZO → Axis

- Tela de login e cabeçalho: símbolo atual (o ícone já usado no app) + "Axis" com o subtítulo "Jornada Cirúrgica".
- Título da página, descrição, nome do app instalável (PWA) e nome curto → "Axis — Jornada Cirúrgica".
- Manter os ícones/favicon atuais como símbolo da marca, sem gerar arte nova.
- Nenhuma referência textual a "EZO Urologia" permanece na interface.

## 5. Parecer: agente de onboarding no Telegram

É viável e de custo baixo, com uma ressalva importante sobre o GitHub.

- **Como funcionaria:** um bot do Telegram conectado a uma função de servidor do app; cada mensagem é respondida por um modelo de IA com uma base de conhecimento sobre o Axis (fluxos do kanban, prazos/tolerâncias, anexos, documentos, pendências, permissões).
- **Sobre "acesso ao GitHub":** ler o código-fonte não é o caminho recomendado — o modelo responderia sobre implementação, não sobre uso, e exporia detalhes internos sem benefício para o usuário final. O resultado é muito melhor com um **manual de uso versionado no próprio projeto**, que o bot consulta. Esse manual é mantido junto com o código, então acompanha as mudanças do produto.
- **Escopo escolhido:** apenas dúvidas sobre o app, sem consultar dados de pacientes. Isso evita qualquer questão de sigilo e dispensa vincular contas do Telegram a usuários do sistema.
- **Esforço:** pequeno (uma função de webhook, uma conexão com o Telegram e o documento de conhecimento). Sugiro fazer depois desta rodada, como tarefa separada.

Este plano **não** implementa o bot — só registra o parecer. Confirme depois se quer executá-lo.

## Detalhes técnicos

- Migração: `profiles.scope_surgeons text[] not null default '{}'`.
- Nova função `current_scope_surgeons()` (stable, security definer) e ajuste de `current_broad_scope()`, `current_scope_surgeon_name()` e `can_access_patient()` para que escopo amplo não se aplique quando `scope_surgeons` estiver preenchido; nesse caso vale `patients.surgeon = ANY(scope_surgeons)`.
- Política de SELECT em `patients` atualizada com o mesmo predicado; políticas de UPDATE/INSERT herdam via `can_access_patient` / checagem de cirurgião permitido.
- `admin-users` (função de servidor) passa a gravar/ler `scope_surgeons`; UI em `src/pages/AdminUsers.tsx` com multiseleção de cirurgiões.
- Novo hook `useStaffNames()` lendo nomes ativos de `profiles` (com política de leitura limitada a nome operacional), consumido por `constants.ts`/`FilterBar`/`AddPatientForm`/`PatientPanel`/`TaskFormFields`, mantendo as listas atuais como fallback.
- Marca: `index.html`, `public/manifest.json`, `src/pages/Auth.tsx`, `src/components/PipelineDashboard.tsx`.
- Verificação: sessões de teste (cirurgião e concierge restrita) confirmando contagem de pacientes visíveis e bloqueio de cadastro fora do escopo.
