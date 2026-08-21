# Menus de cirurgiões e concierges sempre atualizados

## O que está acontecendo

O novo cirurgião **Dr Roberto Rossi Neto** já está cadastrado corretamente no perfil dele (nome operacional preenchido, usuário ativo), e as concierges Tiana e Débora já estão vinculadas ao escopo dele.

O problema é que alguns menus ainda usam listas fixas escritas no código, em vez de ler os profissionais cadastrados:

- Importação de CSV: "Cirurgião padrão" e "Responsável padrão" (foi o menu selecionado na tela).
- Biblioteca de materiais: filtro/seleção de cirurgião (2 lugares).
- Templates de documentos: seleção de cirurgião.
- Lista de responsáveis de ações: a lista base ainda é fixa em um dos pontos.

Além disso, mesmo os menus que já são dinâmicos guardam a lista em cache por 10 minutos e não são recarregados quando o admin altera o cadastro de um profissional — então uma mudança pode levar minutos para aparecer.

## O que será feito

1. **Todos os menus passam a ler os profissionais cadastrados** (perfis ativos com nome operacional), sem listas fixas: importação CSV, Biblioteca, Templates e responsáveis de ações. As listas atuais continuam apenas como base, para não perder nomes históricos usados em pacientes antigos.
2. **Atualização automática após mudanças no cadastro**: ao criar, editar, ativar/desativar um usuário ou mudar nome operacional/escopo na tela Usuários, todos os menus do app são recarregados imediatamente.
3. **Atualização entre sessões**: a lista também é revalidada ao voltar para a aba/janela e ao abrir cada tela, com cache curto — assim, uma alteração feita pelo admin aparece para os outros usuários sem precisar recarregar a página manualmente.
4. **Consistência do "Responsável padrão" no CSV**: passa a oferecer cirurgiões e concierges cadastrados (mantendo "Call Center").

Nenhuma regra de acesso muda: cada usuário continua vendo apenas os pacientes do seu escopo, e os menus de cirurgião respeitam o escopo onde já respeitam hoje.

## Detalhes técnicos

- `useStaffNames`: `staleTime` reduzido (~30s), `refetchOnWindowFocus: true`, `refetchOnMount: true`; expõe `refetch`. Chave `['staff-names']`.
- Invalidação de `['staff-names']` nas mutações de `src/pages/AdminUsers.tsx` (criar/atualizar usuário, ativar/desativar, salvar nomes operacionais e `scope_surgeons`).
- Substituir listas fixas por `useStaffNames()` em `src/components/CsvImporter.tsx`, `src/pages/Library.tsx` (linhas 204 e 372), `src/pages/Templates.tsx` (linha 284) e `TASK_RESPONSIBLES` em `src/components/TaskFormFields.tsx` (uso dinâmico onde o componente renderiza; constante mantida só como fallback).
- Se `defaultSurgeon`/`defaultResponsible` do CSV apontarem para um nome ausente, cair no primeiro nome disponível.
- Verificação: sessão de teste do admin conferindo que "Dr Roberto Rossi Neto" aparece nos quatro menus, e que editar o nome operacional reflete no menu sem recarregar a página.
