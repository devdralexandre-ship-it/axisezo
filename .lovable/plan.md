# Tela branca em axiscrm.app (desktop)

## O que verifiquei agora

- `https://axiscrm.app/` responde 200 e carrega normalmente em navegador limpo (tela de login "EZO Urologia" renderiza, sem erros de JavaScript).
- A publicação está ativa e com visibilidade pública.
- O backend (banco/auth) está saudável.
- Carregando o app autenticado em viewport de desktop (1280x900), o Kanban e o painel de pendências renderizam sem erro.
- O projeto não registra service worker (só um `manifest.json` estático), então não há cache offline "preso" — o cache é do próprio navegador.

Conclusão: não há falha do lado do servidor nem do código publicado. O sintoma "branco só no desktop, normal no celular" é compatível com bundle JavaScript antigo em cache no navegador de desktop, extensão bloqueando scripts, ou redirecionamento/interceptação da rede (proxy, captive portal, rede não segura).

## Passos para você testar (nesta ordem)

1. **Rede não segura / proxy / captive portal**: tente acessar `https://axiscrm.app` usando o hotspot do celular (4G/5G) no desktop. Se funcionar, a rede atual está interceptando, bloqueando ou redirecionando recursos.
2. Abrir `https://axiscrm.app` em uma janela anônima no desktop. Se funcionar, é cache.
3. No navegador normal: recarregar com cache limpo (Ctrl+Shift+R / Cmd+Shift+R).
4. Se ainda ficar branco: limpar dados do site (DevTools > Application > Clear site data) e recarregar.
5. Testar com extensões desativadas (bloqueadores podem impedir o carregamento dos scripts).

Se depois disso continuar branco, me envie:
- O conteúdo da aba Console do DevTools (F12).
- O conteúdo da aba Network > selecione "Blocked response" ou "Blocked requests" (se aparecer).
- Se a barra de endereço mostra algum aviso de "Não seguro" ou certificado inválido.

## Se você quiser que eu já atue no código

Só há uma ação de código que faz sentido preventivamente, e ela é opcional:

- Adicionar um error boundary global no `App.tsx` para que, em caso de erro de renderização, o usuário veja uma mensagem com botão "Recarregar" em vez de tela branca.
- Opcional: republicar o app para garantir que o bundle servido é o mais recente.

Confirme se quer o error boundary e/ou a republicação, ou se prefere primeiro fazer os testes de cache acima.
