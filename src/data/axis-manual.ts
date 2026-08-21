/**
 * Manual de uso do Axis, mantido junto com o código.
 * Usado como base de conhecimento do agente de onboarding (função `axis-help`).
 * Ao mudar o produto, atualize este arquivo — o agente passa a responder conforme.
 */
export const AXIS_MANUAL = `
# Manual do Axis — Jornada Cirúrgica

O Axis é um CRM operacional que acompanha o paciente da indicação cirúrgica até a
cirurgia realizada. O foco é conversão e operação (prazos, orçamentos, documentos),
não liberação clínica.

## Papéis e quem vê o quê

- **Admin**: acesso pleno a tudo — todos os pacientes, valores financeiros, painel de
  Usuários, Duplicados e Tipos de ação.
- **Cirurgião**: vê apenas os pacientes em que ele é o cirurgião responsável.
- **Concierge**: vê os pacientes da sua carteira. Se o admin definir "Cirurgiões que
  este usuário enxerga" no perfil dela, ela passa a ver somente pacientes desses
  cirurgiões. Se a lista estiver vazia, ela enxerga amplamente.
- **Call center**: vê os pacientes, mas **não** vê valores financeiros.
- **Estagiário (intern)**: acesso de leitura ampla, sem recursos administrativos.

Além do papel, cada usuário tem **capacidades** individuais (ex.: ver/editar
financeiro, mover no pipeline, apagar pacientes, gerar documentos, importar CSV,
gerenciar usuários, "apenas atribuídos"). O admin ajusta isso em **Usuários**.
Todo esse controle é aplicado no banco de dados, não só na tela.

Se um usuário diz que "não vê um paciente", quase sempre é escopo: o campo
cirurgião/concierge do paciente não corresponde ao nome operacional do usuário.
O admin corrige em Usuários (nome operacional) ou no cadastro do paciente.

## O pipeline (Kanban)

Colunas, em ordem:

1. **Potencial de indicação** — paciente que ainda pode virar cirurgia. **Não entra
   em nenhuma métrica nem no valor do pipeline** enquanto estiver aqui.
2. **Indicação**
3. **Primeiro Contato**
4. **Preparo de Orçamento**
5. **Orçamento Enviado**
6. **Aguardando Autorização**
7. **Decisão Pendente**
8. **Follow-up / Negociação**
9. **Apto para agendar**
10. **Cirurgia Agendada** — ao arrastar o paciente para cá, o sistema pede a
    **data (e hora) da cirurgia**.
11. **Cirurgia Realizada**
12. **Perdido / Não Procedeu** — ao mover para cá, é **obrigatório** informar o
    motivo: Preço, Demora / Falta de urgência, Contraindicação clínica, Escolheu
    outro prestador, **Ghost** (sumiu, não respondeu) ou Outro.

Para mover: arraste o card no Kanban (no celular, use o menu do card / as abas de
coluna). É preciso a capacidade "mover no pipeline".

## Cadastro de paciente

Botão **Novo paciente**. Campos principais: nome, idade (em anos ou, para crianças,
em **meses**), telefone, procedimento (busca por digitação, sem precisar de acento),
lateralidade e via de acesso (aparecem só quando o procedimento pede), cirurgião,
concierge, origem/local da indicação, **data de indicação**, convênio ou particular,
tipo de faturamento, hospital(is) desejado(s) — é possível marcar **mais de um
hospital** para pedir orçamento — e os campos financeiros (honorários médicos,
anestesia, hospital, materiais), que somam o valor estimado.

Marcadores do card: `*` sensível, `**` altíssimo risco, `★` alto ticket, e o selo
**✨ Novo**, que permanece até a primeira edição do paciente.

Se o nome digitado se parecer com um paciente existente, o sistema avisa para evitar
duplicidade. Duplicados existentes o admin resolve em **Duplicados**, onde é possível
**unificar** dois registros (dados, ações, documentos e anexos vão para o principal).

## Ações (tarefas)

Toda movimentação de paciente pede próximo passo: as ações são obrigatórias.

- **Título** com autocomplete (tipos de ação já usados).
- **Responsável**: cirurgiões e concierges cadastrados; por padrão vem a concierge
  dedicada do paciente.
- **Prazo**: data e hora.
- **Tolerância**: horas extras após o prazo antes de a ação ser considerada vencida.
- Cada tipo de ação tem um **limite máximo de prazo** (definido pelo admin em
  **Tipos de ação**). Se o prazo pedido passar do limite, é obrigatório escrever uma
  **justificativa** — que fica registrada.
- **Escalonamento**: 24 horas depois de a tolerância estourar, a ação escala e
  aparece destacada.

Cores/badges no card: em dia, próxima do vencimento, vencida e escalada.

## Pendências

Tela dedicada às concierges (é para lá que elas caem ao entrar no sistema). Lista o
que exige ação: novos pacientes, ações vencidas e escaladas, orçamentos pendentes.
Clicar no nome do paciente abre o painel individual dele. Várias edições podem ser
feitas ali mesmo, sem abrir o Kanban.

## Anexos e documentos

- **Anexos** (aba do paciente): upload de arquivos por categoria (orçamento, exames,
  documentos pessoais, etc.). Após enviar, o arquivo aparece na lista com miniatura
  (imagens) e pode ser visualizado, baixado ou removido — os botões ficam sempre
  visíveis no celular.
- **Documentos**: geração de PDF a partir de modelos (orçamento, solicitação
  cirúrgica, atestado, relatório, receita) e **assinatura digital** pelo cirurgião
  responsável, com página pública de verificação.

## Notas da concierge

Aba de notas no paciente. Cada nota registra **autor e data**. Pode ser marcada como
**"Para cirurgião"** quando o recado é para o médico. A nota pode ser **editada
apenas nas 2 primeiras horas** e **não pode ser apagada** — é histórico.

## Visualizações e filtros

- **Kanban** e **Planilha** (mesmos filtros, um paciente por linha).
- Filtros combináveis: cirurgião, concierge, estágio, convênio, faturamento,
  hospital, origem, marcadores e **data de indicação**.
- No celular, os filtros ficam em um menu expansível; há ordenação por coluna.

## Relatórios

Painel com métricas de conversão. Pontos importantes:

- O filtro de data é sempre a **data de indicação**.
- Conversão separada para **particular** e **convênio**.
- **SLA de orçamento**: considera cumprido quando o **primeiro orçamento** é anexado
  em até **24 horas**, independentemente de quantos hospitais foram selecionados.
- Pacientes em "Potencial de indicação" ficam fora das métricas.
- Exportação em CSV.
- Usuários sem permissão financeira veem as métricas sem valores.

## Telas administrativas (só admin)

- **Usuários**: criar contas (não existe cadastro público), definir papel, nome
  operacional, capacidades, escopo de cirurgiões e ativar/desativar.
- **Duplicados**: detectar e unificar pacientes repetidos.
- **Tipos de ação**: nomes, limite máximo de prazo e tolerância padrão.
- **Perfil**: dados profissionais (CRM, RQE), senha e autenticação em dois fatores.

## Dúvidas frequentes

- *"Perdi o acesso / não vejo o Kanban"*: confirme com o admin se seu usuário está
  ativo e se o nome operacional está preenchido corretamente.
- *"Não consigo cadastrar paciente"*: normalmente falta o nome operacional no perfil
  ou o cirurgião escolhido está fora do seu escopo.
- *"Minha ação não aparece como atrasada"*: confira o prazo e a tolerância; o limite
  por tipo de ação evita prazos exagerados.
`;
