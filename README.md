# Axis — Pipeline cirúrgico

CRM operacional para acompanhamento de pacientes ao longo do pipeline cirúrgico.

## Segurança

### Quem vê o quê

O acesso aos dados é controlado por papel (`admin`, `surgeon`, `concierge`, `call_center`) e aplicado **no banco de dados** via Row-Level Security. O frontend não consegue ver dados que o backend não autorize, independente de bugs na UI.

| Papel | Pacientes que enxerga | Vê valores financeiros? | Painel admin |
|---|---|---|---|
| Admin | Todos | Sim | Sim (`/admin/users`) |
| Surgeon | Apenas onde `patients.surgeon` bate com sua identidade | Sim | Não |
| Concierge | Apenas onde `patients.concierge` bate com sua identidade | Sim | Não |
| Call Center | Todos | **Não** | Não |

A identidade operacional (`surgeon_name` / `concierge_name`) é definida no painel admin e precisa **bater exatamente** com o que está em `patients.surgeon` / `patients.concierge`.

### Cadastro de novos usuários

O cadastro público está **desativado**. Apenas administradores podem criar contas, em **Usuários** no topo do dashboard ou diretamente em `/admin/users`.

### Sobre o arquivo `.env`

O `.env` deste projeto contém **apenas chaves públicas** (URL do backend e a chave anônima). Não são segredos — qualquer cliente que conversa com o backend precisa delas, e elas aparecem inevitavelmente em qualquer requisição feita pelo navegador. Sozinhas, **não dão acesso a nada**: toda proteção de dados é feita por Row-Level Security no servidor.

Os segredos reais (`SUPABASE_SERVICE_ROLE_KEY`, chaves de API privadas, etc.) ficam armazenados no cofre do Lovable Cloud e **nunca** vão para o código nem para o navegador. São acessíveis somente dentro de Edge Functions no servidor.

Vazamentos de `.env` que afetam outras plataformas geralmente expõem o `SERVICE_ROLE_KEY` ou senhas de banco — esses não estão e nunca estiveram em `.env` neste projeto.

### Senhas

A proteção contra senhas vazadas (HIBP) está ativada: senhas que aparecem em vazamentos públicos são rejeitadas no cadastro/troca.
