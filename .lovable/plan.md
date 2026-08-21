# Por que o agente recusou a pergunta sobre certificado digital

## O motivo

O agente responde **somente** com base no manual do Axis que está versionado no projeto, e é instruído a dizer que não sabe quando o assunto não está lá — justamente para não inventar telas e botões.

O manual atual traz apenas uma linha sobre assinatura ("geração de PDF a partir de modelos e assinatura digital pelo cirurgião responsável, com página pública de verificação"). Ele **não descreve** o que o app realmente já tem, verificado no código do Perfil e no fluxo de assinatura:

- envio do certificado **A1 (.pfx)** com senha, na tela Perfil;
- exibição do certificado cadastrado, aviso de expirado e opção de revogar;
- **modo de delegação** ("sempre", "por documento", "nunca") — quem pode assinar usando o certificado do cirurgião;
- **histórico de uso do certificado** (toda assinatura, própria ou feita por concierge em nome do cirurgião);
- confirmação de assinatura indicando de quem é o certificado usado;
- autorização por documento pelo cirurgião responsável, quando o modo exige.

Ou seja: a recusa foi o comportamento correto do agente, mas a base de conhecimento está incompleta. A correção é ampliar o manual.

## O que será feito

1. **Nova seção "Assinatura digital e certificado A1"** no manual, cobrindo: como enviar o .pfx e a senha no Perfil, o que acontece com a senha (fica criptografada no servidor), certificado expirado, revogação, os três modos de delegação e o que cada um permite, autorização por documento, histórico de uso e a página pública de verificação do documento.
2. **Revisão de lacunas semelhantes** no manual, para não repetir a recusa em temas que o app já tem: perfil profissional (CRM, RQE, título de assinatura), autenticação em dois fatores, importação de pacientes por CSV, biblioteca de materiais/pacotes e envio ao paciente, modelos de documentos, checklist pré-operatório e pendências do paciente.
3. **Instrução de recusa mais útil**: quando o assunto realmente não estiver no manual, o agente passa a indicar a tela mais provável e sugerir avisar o admin de que falta documentação — em vez de só encerrar.

Sem mudança de interface: o botão de ajuda e o painel continuam iguais.

## Detalhes técnicos

- Edição de `supabase/functions/axis-help/manual.ts` (novas seções; backticks continuam escapados por ser template literal) e ajuste do bloco de regras em `supabase/functions/axis-help/index.ts`.
- Redeploy da função `axis-help`.
- Verificação: repetir a pergunta sobre certificado digital e mais duas (delegação de assinatura, 2FA) na própria função e confirmar respostas corretas e alinhadas ao app.
