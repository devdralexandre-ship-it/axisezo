# Os 3 avisos de segurança: o que são e o que fazer

Nenhum dos três expõe dados a estranhos ou à internet. Todos exigem alguém **já logado no Axis e com acesso legítimo àquele paciente**. São falhas de "abuso interno": um usuário da equipe conseguiria fazer algo que a interface não oferece, usando uma chamada direta ao banco. Verifiquei as três políticas no banco e todas confirmam o que o scanner descreveu.

## 1. Lista de "atribuídos" pode ser alterada por qualquer um (mais relevante)

Hoje, quem pode editar um paciente pode também alterar o campo interno que lista **quais usuários têm acesso individual àquele paciente**.

Consequência prática: uma estagiária ou atendente com acesso a um paciente poderia adicionar outra conta qualquer nessa lista, dando a essa pessoa acesso permanente ao prontuário e aos valores daquele paciente — furando o escopo por cirurgião/concierge. A interface não tem esse botão, então exigiria uso deliberado de ferramentas técnicas.

Risco real: baixo-médio, mas é o único dos três que pode **ampliar quem vê dados de paciente**. Vale corrigir.

**Correção:** só admin pode alterar essa lista de atribuídos; todos os outros campos seguem editáveis como hoje.

## 2. Nota da concierge pode ser "movida" para outro paciente

Nas 2 horas em que o autor pode corrigir a própria nota, ele poderia trocar o paciente vinculado à nota — inclusive para um paciente que ele não enxerga.

Consequência: o texto da nota apareceria na ficha de um paciente errado. Não vaza dado de paciente para quem não deveria ver (a nota é escrita pelo próprio autor), mas suja o registro e é um caminho de "plantar" texto em fichas alheias.

Risco real: baixo. Correção é trivial.

**Correção:** exigir, na edição, que o paciente da nota continue sendo um paciente acessível ao autor (na prática, o gatilho já impede a troca de paciente — a regra do banco passa a reforçar o mesmo).

## 3. Campos de assinatura de documentos sem validação de autoria

Nos documentos do paciente existem campos que registram **quem assinou** e **quem autorizou a assinatura**. A regra atual não confere se esses campos correspondem ao usuário que está de fato agindo.

Consequência: alguém com acesso ao paciente poderia gravar o nome/ID de outro profissional nesses campos, criando atribuição falsa de assinatura no registro do banco.

Importante: isso **não** falsifica o PDF assinado. A assinatura digital ICP-Brasil é feita no servidor, com o certificado do cirurgião, e o log de auditoria de assinaturas tem cadeia de hash própria e é imutável. O impacto fica nos metadados exibidos na ficha — ainda assim indesejável num sistema com valor jurídico.

Risco real: baixo, mas em contexto médico-legal vale fechar.

**Correção:** aceitar esses campos apenas quando apontarem para o próprio usuário (ou ficarem vazios), liberando exceção para admin; a autorização continua sendo feita pela função de servidor existente, que já valida o cirurgião responsável.

## Recomendação

Corrigir os três — são ajustes de regra no banco, sem mudança visível para os usuários e sem risco de quebrar fluxos existentes. Se preferir, posso corrigir só o item 1 (o de maior impacto) e marcar os outros dois como aceitos.

## Detalhes técnicos

Uma migração única com três ajustes de política:

- `patients` UPDATE: recriar `Scoped update patients` com `WITH CHECK` adicionando `(current_is_admin() OR assigned_user_ids = (SELECT p.assigned_user_ids FROM public.patients p WHERE p.id = patients.id))`, comparando o valor novo com o persistido para bloquear alteração por não-admin.
- `patient_notes` UPDATE: `WITH CHECK` passa a ser `author_user_id = auth.uid() AND can_access_patient(patient_id)`.
- `patient_documents` UPDATE: `WITH CHECK` passa a exigir, além de `can_access_patient(patient_id)`, que `signed_by`/`signature_authorized_by` sejam nulos ou iguais a `auth.uid()`, salvo `current_is_admin()`. As funções `sign-pdf` e `authorize_document_signature` rodam como security definer / service role e não são afetadas.

Verificação após a migração: reexecutar o scan de segurança, marcar os três achados como corrigidos e conferir, via consulta às políticas, que edição comum de paciente, criação/edição de nota e geração de documento continuam funcionando.
