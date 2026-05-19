## Causa do erro

A RLS de INSERT em `patients` exige, para o papel `concierge`:

```
concierge = current_concierge_name()  -- valor do profile, no caso 'Margô'
```

No formulário de novo paciente o campo "Concierge" começa **vazio** e não é obrigatório. Quando a Margô incluiu o paciente sem selecionar a si mesma na lista, a linha foi gravada com `concierge = ''`, o que viola a policy e retorna o erro. Com seu login (admin) a policy passa por outro caminho e funciona normalmente.

## Plano de correção (apenas frontend, sem mexer em RLS)

Garantir que, quando o usuário logado é concierge, o paciente sempre seja criado vinculado a ele.

1. **`src/components/AddPatientForm.tsx`**
   - Usar `useUserRole()` para ler `isConcierge` e `conciergeName`.
   - Inicializar `concierge` com `conciergeName` quando o usuário é concierge (via `useState` + `useEffect` ao abrir o diálogo).
   - Desabilitar o `Select` de concierge para esse papel (mostrar o nome dele já selecionado, sem poder trocar). Admin/cirurgião/call center continuam podendo escolher livremente.

2. **`src/hooks/usePatients.ts` (`useAddPatient`)**
   - Como defesa em profundidade, antes do `insert` ler o perfil do usuário atual (`profiles.concierge_name` / `surgeon_name`) e:
     - se o usuário só tem papel `concierge` e `concierge` veio vazio, preencher com o nome dele;
     - mesma lógica espelhada para `surgeon`, evitando o mesmo bug acontecer com cirurgiões.
   - Isso protege também o CSV importer e qualquer caminho futuro.

3. **Mensagem de erro mais clara**
   - No `onError` do `useAddPatient`, se a mensagem contiver `row-level security`, exibir um toast amigável: *"Você só pode cadastrar pacientes vinculados a você. Verifique o campo Concierge/Cirurgião."*

## Resultado esperado

- Margô abre o formulário → campo "Concierge" já vem preenchido com "Margô" e travado → insert respeita a policy → paciente é criado.
- Admin continua podendo escolher qualquer concierge.
- Nenhuma mudança em RLS, migrations ou schema.
