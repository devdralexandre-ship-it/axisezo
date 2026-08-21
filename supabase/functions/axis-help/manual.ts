/**
 * Manual de uso do Axis, mantido junto com o código.
 * Usado como base de conhecimento do agente de onboarding (função `axis-help`).
 * Ao mudar o produto, atualize este arquivo — o agente passa a responder conforme.
 */
export const AXIS_MANUAL = `
# Manual do Axis — Jornada Cirúrgica

O Axis é um CRM operacional que acompanha o paciente da indicação cirúrgica até a
cirurgia realizada. O foco é conversão e operação (prazos, orçamentos, documentos,
assinaturas), não liberação clínica.

Não existe cadastro público: as contas são criadas pelo administrador da clínica.
Na tela de login há e-mail + senha e o link "Esqueci minha senha" (envia e-mail de
redefinição; a nova senha precisa de no mínimo 8 caracteres). O aplicativo não é
indexado por buscadores — só é acessível a usuários cadastrados.

---

## 1. Papéis, capacidades e escopo (quem vê o quê)

Papéis: **Admin**, **Cirurgião**, **Concierge**, **Call center**, **Estagiária**.
Um usuário pode ter mais de um papel. Admin tem todas as capacidades sempre.

Além do papel, cada usuário tem **capacidades** individuais, ajustadas pelo admin em
**Usuários**, com presets rápidos (Acesso pleno, Operacional sem financeiro,
Cirurgião padrão, Concierge padrão, Estagiária restrita, Customizado):

- Financeiro: **Ver valores financeiros**, **Editar dados financeiros**.
- Pacientes: **Editar dados clínicos**, **Mover no Kanban**, **Deletar pacientes**,
  **Restringir aos pacientes atribuídos** (vê apenas pacientes onde está atribuído).
- Documentos e biblioteca: **Gerar/assinar documentos**, **Gerenciar templates**,
  **Gerenciar biblioteca de orientações**.
- Operacional: **Importar CSV / exportar**, **Ver dashboard global**,
  **Gerenciar usuários**.

**Escopo de cirurgiões**: no cadastro de cada usuário não-admin o admin pode marcar
de quais cirurgiões aquele usuário enxerga os pacientes. Se nada for marcado, o
usuário mantém o acesso amplo (concierges veem todos os pacientes). Ao marcar um ou
mais cirurgiões, ele passa a ver e cadastrar **apenas** pacientes desses cirurgiões.
Admin sempre vê tudo.

Sem a capacidade "Ver valores financeiros", o usuário continua trabalhando
normalmente, mas colunas e cards de valores desaparecem (tabela, KPIs, relatórios).

Todas essas regras são aplicadas no próprio banco de dados, não apenas na tela: não
é possível burlar escondendo ou forçando um botão.

Se alguém diz que "não vê um paciente", quase sempre é escopo ou nome operacional:
o campo cirurgião/concierge do paciente precisa corresponder exatamente ao nome
operacional cadastrado para o usuário. O admin corrige em **Usuários** ou no cadastro
do paciente.

---

## 2. Pipeline (Kanban)

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
10. **Cirurgia Agendada** — ao mover para cá o sistema pede **data e hora** da cirurgia.
11. **Cirurgia Realizada**
12. **Perdido / Não Procedeu** — obrigatório informar o motivo: Preço, Demora / falta
    de urgência, Contraindicação clínica, Escolheu outro prestador, **Ghost** (sumiu,
    não respondeu) ou Outro.

Para mover: arraste o card (no celular, use as abas de coluna e o menu do card).
Exige a capacidade "Mover no Kanban". Excluir paciente só aparece com a capacidade
"Deletar pacientes".

**Visualizações**: alterne entre **Kanban** e **Planilha**. A planilha traz um
paciente por linha com as colunas Paciente, Etapa, Decisão, Procedimento, Cirurgião,
Concierge, Tipo, Faturamento, Convênio, Hospital, Indicação, Dias desde a indicação,
Idade, Telefone, E-mail, Ticket estimado e Honorários (só com permissão financeira),
Data da cirurgia, Próxima ação, Vencimento, Motivo da perda, Sinais e Criado em.
As colunas são ordenáveis por clique e há **Exportar CSV** (só com as colunas que o
usuário pode ver).

**Filtros combináveis** (mesmos no Kanban e na planilha): busca por nome, cirurgião,
concierge, procedimento, tipo (adulto/pediátrico), via cirúrgica, convênio,
faturamento, hospital, origem da indicação e período de **data de indicação**.
No celular ficam num painel "Filtros" com contador de filtros ativos. Há também
controle de ordenação das colunas.

---

## 3. Cadastro e ficha do paciente

Botão **Novo paciente**. Campos: nome, idade (em **anos** ou, para crianças, em
**meses**), telefone, e-mail, responsável, procedimento (busca por digitação, sem
precisar de acento), **lateralidade** (Direita/Esquerda/Bilateral) e **via de acesso**
(Convencional/Laparoscópica/Robótica) — que aparecem apenas nos procedimentos que
pedem —, tipo (adulto/pediátrico), cirurgião, concierge, origem/local da indicação,
**data de indicação**, convênio (ou "Não tem"), tipo de faturamento (Cooperuro,
Unicooper, Honorários Médicos Particulares, Custos Totais Particulares),
**hospital(is) desejado(s)** — é possível marcar **mais de um** para pedir orçamento —
e os campos financeiros (honorários médicos, 1º auxiliar, instrumentador, anestesia,
orçamento hospitalar, materiais), que somam o valor estimado exibido no card.

Marcadores do card: \`*\` clinicamente sensível, \`**\` altíssimo risco, \`★\` alto
ticket, e o selo **✨ Novo**, que permanece até a primeira edição do paciente.
A **data de indicação** aparece destacada no card.

Se o nome digitado se parecer com um paciente já existente, o sistema avisa para
evitar duplicidade.

**Checklist pré-operatório** (dentro da ficha), com barra de progresso: Exames
pré-operatórios; Risco cirúrgico / Parecer especialista; Consulta pré-anestésica;
Pedido cirúrgico; Autorização; Agendamento da cirurgia. Cada clique já salva.

**Notas da concierge**: cada nota registra autor e data, pode ser marcada como
**"Para cirurgião"**, é editável **apenas nas 2 primeiras horas** e **não pode ser
apagada** — é histórico. Cards e Pendências mostram quantas notas existem.

---

## 4. Anexos (documentos do paciente)

Na ficha, seção "Documentos do paciente". Antes de enviar, escolha a **categoria**:
RG / Documento, Exame, Laudo, Autorização, Foto clínica, Outro. Botão **Arquivo**
(PDF ou imagem, vários de uma vez) e botão **Foto** (abre a câmera no celular).

Regras: máximo **20 MB** por arquivo; formatos HEIC/HEIF do iPhone não são aceitos
(no iPhone: Ajustes → Câmera → Formatos → "Mais Compatível", ou envie JPEG/PNG).
Após o envio aparece confirmação e o item fica destacado por alguns segundos. Se um
arquivo falhar, a linha mostra o erro com "Tentar novamente" e "Descartar".

Cada arquivo enviado mostra nome, categoria, tamanho e data, com botões **Abrir**
(imagem em janela, PDF em nova aba), **Baixar** e **Excluir** (pede confirmação; não
pode ser desfeito). Os botões ficam sempre visíveis no celular.

---

## 5. Documentos gerados e assinatura digital

**Templates** (menu Templates): um modelo por tipo de documento, opcionalmente por
cirurgião, com opção "marcar como padrão". Tipos: Solicitação Cirúrgica, Receita,
Atestado, Relatório, Orçamento. Dois modos: **HTML** (logo do cabeçalho até 1 MB,
cabeçalho, corpo com variáveis \`{{...}}\`, rodapé) ou **PDF Timbrado** (upload do
papel timbrado até 5 MB, demarcação visual da área de conteúdo e da área de
assinatura, e estratégia para páginas extras: repetir o timbre, usar a página 2 ou
folha em branco). Sem template salvo, o sistema usa o padrão.

**Gerar documento**: na ficha, "Novo documento" → escolha o tipo (o template é
selecionado automaticamente por tipo + cirurgião), ajuste o título, preencha o
formulário e veja o **preview** ao lado; depois "Gerar PDF". Formulários:

- **Solicitação Cirúrgica**: dados do paciente; procedimento e códigos (CBHPM
  principal com autocomplete, procedimentos complementares, CID, OPME com
  quantidade, descrição cirúrgica editável); regime (Hospitalar/Hospital-dia),
  reserva de UTI e de sangue; forma de faturamento. Ao gerar com códigos
  preenchidos, o sistema oferece **salvar como padrão** do cirurgião e/ou da
  concierge (reaproveitados nos próximos documentos e visíveis em Perfil).
- **Orçamento**: identificação, honorários (cirurgião, 1º auxiliar opcional,
  instrumentador, anestesia), orçamento hospitalar e materiais, validade em dias
  (padrão 30), data, cidade, observações e **total estimado** automático.
- **Atestado**: dias de afastamento, data, CID e a chave "paciente concorda com a
  inclusão do CID" — se desligada, o CID é omitido do atestado.
- **Relatório**: texto livre, data e cidade (a sugestão por IA ainda não está ativa).
- **Receita**: medicações em texto livre, com data e cidade opcionais.

**Assinatura digital A1 (ICP-Brasil)**:
- Cada cirurgião cadastra o próprio certificado em **Perfil** (arquivo .pfx/.p12 +
  senha). A senha é criptografada e não pode ser lida por ninguém. Há indicação de
  validade, aviso de certificado expirado e botão para revogar.
- **MFA (autenticação em dois fatores) é obrigatório para assinar**: ative em
  Perfil → Ativar MFA (QR code em app autenticador + código de 6 dígitos). Na hora de
  assinar, se a sessão ainda não estiver verificada, o sistema pede o código antes de
  liberar o botão Assinar.
- **Modo de delegação** (definido pelo cirurgião em Perfil): **Sempre** (quem tem
  acesso pode assinar com o certificado dele), **Por documento** (a concierge só
  assina documentos que o cirurgião liberou individualmente, com o botão "Liberar
  para a concierge assinar") ou **Nunca** (só o próprio cirurgião assina).
- **Histórico/auditoria**: o cirurgião vê todo uso do seu certificado (documento,
  paciente, data, quem assinou, sucesso ou falha) e a concierge vê as assinaturas
  que realizou.
- **Verificação pública**: o PDF assinado traz link/QR que abre uma página aberta
  mostrando signatário, CRM, especialidade, iniciais do paciente, documento, data,
  validade do certificado e hash SHA-256. Reassinar um documento marca o registro
  anterior como revogado/substituído. A validação criptográfica completa deve ser
  feita no Adobe Reader ou em validar.iti.gov.br.

---

## 6. Ações (tarefas) e prazos

Toda movimentação de paciente pede próximo passo: as ações são obrigatórias.

- **Tipo da ação** (catálogo do admin): ao escolher, o prazo é preenchido com
  "agora + prazo máximo do tipo" e a tolerância com o padrão do tipo.
- **Título** com autocomplete de títulos já usados.
- **Prazo máximo** (data e hora) e **Responsável** (cirurgiões e concierges
  cadastrados; por padrão vem a concierge dedicada do paciente).
- **Tolerância (horas)**: tempo extra contado após o prazo. Depois disso a ação é
  **escalada automaticamente (24h)** e segue visível para a concierge responsável e
  para o cirurgião do caso.
- **Justificativa de extensão**: se o prazo escolhido passar do limite do tipo, é
  obrigatório justificar — a ação fica marcada como "prazo estendido" nos relatórios.

Cards e listas mostram o status: em dia, próxima do vencimento, vencida e escalada.

**Sino de notificações**: agrupa Atrasadas, Vencem hoje, Sem próxima ação e Próximas
48h; abre uma vez por dia quando há urgências e permite marcar tudo como lido.

---

## 7. Pendências

Tela dedicada à operação — é para lá que a concierge cai ao entrar no sistema.
Lista as tarefas em aberto de pacientes ativos, agrupadas em **Estouradas /
Escaladas**, **Hoje**, **Esta semana** e **Futuras**. Filtros: nome, concierge
(já pré-selecionada para quem é concierge), cirurgião e estágio.

Cada card mostra paciente, estágio, marcadores, notas, título da ação, responsável,
vencimento, situação de prazo e telefone clicável. Dá para alternar os marcadores,
trocar o estágio e **Concluir** a tarefa — ao concluir, o sistema já abre a criação
da próxima ação. Mudanças para "Perdido" ou "Cirurgia agendada" precisam ser feitas
na ficha do paciente (motivo ou data). Clicar no nome abre o painel do paciente.

---

## 8. Biblioteca de orientações

Menu **Biblioteca** (capacidade "Gerenciar biblioteca"). Duas abas:

- **Materiais**: título, descrição, tipo (Texto / Vídeo / PDF), fase (Pré-op /
  Pós-op / Geral), cirurgião e procedimento (ou genérico). Conforme o tipo, informe o
  conteúdo, a URL do vídeo ou o PDF.
- **Pacotes**: agrupam vários materiais com nome, descrição, fase, cirurgião e
  procedimento.

Na ficha do paciente, a seção **Orientações** filtra por Todos / Pré-op / Pós-op /
Geral / Pacotes, sugere automaticamente o pacote pré-op (estágios de cirurgia
agendada e preparo) ou pós-op (cirurgia concluída), permite **Ver** o material e
marcar **"Enviei"** para registrar o envio ao paciente.

---

## 9. Importação de pacientes (CSV)

Menu **Importar CSV** (capacidade "Importar CSV"). Fluxo: envie o arquivo
(.csv/.tsv/.txt), defina **cirurgião padrão** e **responsável padrão**, revise a
prévia e importe.

Na revisão o sistema mostra Total, Limpos, Com alertas e Selecionados, com alertas
por linha: convênio desconhecido, status desconhecido, possível duplicata (no CRM ou
dentro do próprio arquivo), nome não informado (linha vem desmarcada) e hospital com
grafia inconsistente. Cada linha pode ser editada antes de importar (nome, telefone,
procedimento, convênio, estágio, hospital, origem, notas).

Ao final, **cada paciente importado recebe automaticamente uma ação "Confirmar
status" com vencimento em 48h**.

---

## 10. Relatórios

Base de datas: sempre a **data de indicação** (na falta dela, a data de cadastro).
Períodos: 7, 30, 90 dias, mês atual, tudo ou intervalo personalizado. Filtros
combináveis (E lógico): concierge, cirurgião, financeiro (todos / particulares /
convênio) e convênio específico. Pacientes em "Potencial de indicação" ficam fora de
todas as métricas.

- **KPIs**: no pipeline, conversão % (realizadas ÷ realizadas + perdidos) e — só com
  permissão financeira — ticket médio e receita projetada.
- **Conversão Particulares**, separada em "Honorários Médicos Particulares" e "Custos
  Totais Particulares": conversão, em andamento, realizadas, ticket médio, gráfico e
  top 5 motivos de perda.
- **Conversão Convênio**: mesmas métricas por convênio.
- **SLA de orçamento (24h)**: cumprido quando o **primeiro orçamento** é anexado no
  Axis em até 24 horas, **independentemente de quantos hospitais** foram
  selecionados. Mostra aderência, no prazo, estourados, pendentes e a lista de casos
  estourados.
- **Funil por estágio**, **Perdidos por motivo**, **Receita por convênio** (com
  permissão financeira) e **Produtividade por concierge** (pacientes, ações
  concluídas, saúde de SLA).
- **Exportação CSV** por bloco e "Exportar tudo (CSV)".

---

## 11. Telas administrativas

- **Usuários** (admin ou "Gerenciar usuários"): criar conta (nome, e-mail, senha
  temporária de 8+ caracteres, papéis), definir nome operacional de cirurgião/
  concierge, capacidades, escopo de cirurgiões, ativar/desativar conta, enviar
  e-mail de redefinição de senha e excluir usuário. O usuário deve trocar a senha no
  primeiro acesso usando "Esqueci minha senha".
- **Duplicatas** (admin): agrupa por nome normalizado; marca "Alta confiança" quando
  telefone ou e-mail coincidem. Escolha "Manter este" e use **Unificar no principal**:
  documentos, anexos, ações, contatos, pendências, itens do checklist e materiais
  enviados são transferidos para o principal e os duplicados são excluídos. Os campos
  do principal não são sobrescritos e a ação não pode ser desfeita.
- **Tipos de ação** (admin): nome, **prazo máximo (h)**, **tolerância (h)** e
  ativo/inativo. O prazo máximo é contado da criação da ação; prazos acima do limite
  só passam com justificativa e ficam marcados como "prazo estendido".
- **Perfil** (todos): nome de exibição, especialidade, CRM, UF, RQE, telefone e
  e-mail profissionais; códigos padrão salvos; certificado A1, modo de delegação e
  histórico de assinaturas; ativação de MFA.

---

## 12. Segurança e privacidade dos dados

Como o Axis protege:
- Acesso somente com login; nenhuma tela de dados de paciente é pública (a única
  página aberta é a verificação de assinatura, que mostra apenas iniciais do
  paciente, dados do signatário e hash do PDF).
- O aplicativo não é indexado por buscadores.
- As regras de quem vê o quê (papel, capacidades, escopo de cirurgiões, "apenas
  atribuídos") são aplicadas no banco de dados, linha a linha.
- Arquivos e PDFs são acessados por links temporários assinados, não por endereços
  públicos permanentes.
- Senhas de certificado A1 são criptografadas e nunca legíveis por outro usuário;
  assinar exige MFA e a delegação é controlada pelo próprio cirurgião.
- Todo uso de certificado gera registro de auditoria; notas da concierge não podem
  ser apagadas; conteúdos de texto são sanitizados antes de exibir.

O que se espera de cada usuário:
- Nunca compartilhar login, senha, senha do certificado ou código de MFA.
- Não exportar CSV nem baixar documentos para dispositivos ou contas pessoais sem
  necessidade operacional; apagar cópias locais depois do uso.
- Não enviar dados de paciente por canais não corporativos (grupos pessoais, redes
  sociais) nem colar dados reais em ferramentas externas de IA.
- Conferir o paciente correto antes de anexar arquivos ou gerar documentos.
- Manter telas bloqueadas em consultórios e hospitais; sair da conta em computadores
  compartilhados.
- Avisar o administrador imediatamente em caso de acesso indevido, celular perdido
  ou desligamento de alguém da equipe (a conta deve ser desativada).
- Registrar informação clínica sensível somente quando necessária para a operação;
  usar o marcador \`*\` para sinalizar sensibilidade.

O assistente de ajuda do Axis não tem acesso a dados de pacientes, valores, agendas
ou relatórios reais, e não deve receber dados de pacientes nas perguntas.

---

## 13. Dúvidas frequentes

- *"Não vejo o Kanban / perdi o acesso"*: confirme com o admin se a conta está ativa,
  se o nome operacional está preenchido e qual o escopo de cirurgiões.
- *"Não consigo cadastrar paciente"*: normalmente falta o nome operacional no perfil
  ou o cirurgião escolhido está fora do seu escopo.
- *"Não vejo valores"*: falta a capacidade "Ver valores financeiros".
- *"Não consigo assinar"*: verifique MFA ativo, certificado A1 válido do cirurgião
  responsável e o modo de delegação (no modo "Por documento" o cirurgião precisa
  liberar o documento).
- *"Minha ação não aparece como atrasada"*: confira prazo e tolerância; o limite por
  tipo de ação evita prazos exagerados.
- *"O arquivo do iPhone não sobe"*: é o formato HEIC — mude para "Mais Compatível" ou
  envie JPEG/PNG, e respeite o limite de 20 MB.
- *"Paciente duplicado"*: o admin unifica em Duplicatas.
`;
