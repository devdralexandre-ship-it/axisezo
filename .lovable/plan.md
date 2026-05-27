## Diagnóstico

- O perfil da Margô no banco está correto (`role=concierge`, `concierge_name='Margô'`), as funções `current_concierge_name()` / `has_role()` retornam o esperado, e a política RLS de INSERT em `patients` aceita `concierge='Margô'` para um usuário concierge. Manualmente, o cenário **passa** na RLS.
- Publicado está "up to date", então o bundle de produção é o mesmo do preview — já tem o auto-lock e a defesa em profundidade.
- Mesmo assim, nenhum paciente foi inserido por ela hoje. Ou seja: o INSERT chega no Postgres com um valor de `concierge` diferente de `'Margô'` (ou ainda em branco), por algum motivo que não consigo provar sem ver a request real.

Logs do Postgres / PostgREST não trazem o payload do INSERT que falhou, então o próximo passo é capturar essa informação direto do navegador da Margô.

## Plano

### 1. Primeiro: descartar cache do navegador (sem código)
Antes de mexer em qualquer coisa, pedir para a Margô:
- Fazer **hard refresh** em `axiscrm.app` (Ctrl+Shift+R no Windows, Cmd+Shift+R no Mac).
- Tentar cadastrar de novo um paciente de teste.

Se o erro sumir → era cache do `index.html` antigo. Fim.

### 2. Se ainda falhar: adicionar diagnóstico temporário em `useAddPatient`
Pequena instrumentação só para essa investigação, em `src/hooks/usePatients.ts`:

- Antes do `.from('patients').insert(...)`, fazer `console.log('[addPatient] payload', { surgeon: surgeonName, concierge: conciergeName, role-info })` incluindo `user.id` e o resultado da leitura de `profiles`.
- No `onError`, exibir no toast (de forma curta) `e?.code` e os primeiros caracteres de `e?.details`/`e?.hint`, para sabermos qual branch da policy quebrou.
- Adicionar um *guard* explícito: se o usuário tem role concierge e `conciergeName` final está vazio, abortar o insert e mostrar toast claro "Seu perfil não tem concierge_name vinculado — fale com o admin", em vez de deixar a RLS falhar.

### 3. Coletar dado e fechar o caso
Pedir para a Margô:
- Abrir o console do navegador (F12 → aba Console) antes de tentar.
- Tentar cadastrar.
- Mandar print do console + do toast.

Com isso eu saberei se o payload está chegando como `concierge=''`, `concierge='Margo'` (sem acento, mismatch UTF-8), ou outra coisa, e aí o fix definitivo é trivial.

### 4. Depois do fix definitivo
Remover o `console.log` e simplificar o toast de volta para a mensagem amigável que já existe.

## Detalhes técnicos

- Arquivos tocados na etapa 2: apenas `src/hooks/usePatients.ts` (mutação `useAddPatient`).
- Nada muda em banco, RLS, funções, edge functions ou no `AddPatientForm`.
- Diagnóstico é não-destrutivo e revertido na etapa 4.