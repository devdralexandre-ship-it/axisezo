# Conectar o projeto Axis ao GitHub para backup e colaboração

## Objetivo

Ativar o **Git sync nativo do Lovable** para enviar o código do projeto Axis — e futuras alterações — para um repositório no GitHub.

## Contexto atual

- A árvore de trabalho está limpa e o `main` está no commit `37710ab` (última alteração: remoção de prazos de pacientes em estágios finais).
- O repositório remoto atual é o **armazenamento Git privado do Lovable**, não o GitHub.
- As alterações já estão commitadas e pushadas no Lovable, mas não espelhadas no GitHub.

## O que será feito

1. **Ativar a integração GitHub no Lovable**
   - Usar o menu Plus (+) → GitHub → Connect project.
   - Autorizar o app Lovable na conta GitHub desejada.
   - Escolher a conta/organização e criar um novo repositório (público ou privado).
   - O Lovable não importa repositórios GitHub existentes; ele cria um novo e envia o código atual.

2. **Verificar o primeiro sync**
   - Confirmar que o commit `37710ab` e o histórico correspondente aparecem no repositório GitHub.
   - Conferir que o branch `main` do GitHub reflete o `main` do Lovable.

3. **Confirmar o fluxo contínuo**
   - Garantir que o sync é bidirecional: alterações feitas no Lovable enviam automaticamente para o GitHub, e pushs no GitHub refletem no Lovable.
   - Caso o usuário queira trabalhar com branches, mencionar que é preciso habilitar **GitHub Branch Switching** em Account Settings > Labs.

## O que não será alterado

- Nenhum arquivo da aplicação será modificado.
- Não será usado o connector de GitHub para chamadas de API em runtime (esse connector é para automações que consomem dados do GitHub, não para backup de código).

## Verificação

- URL do novo repositório no GitHub.
- Commit `37710ab` presente no GitHub.
- Teste de sync enviando uma pequena alteração futura para o GitHub.
