# Impedir indexação do app em motores de busca

O app continua publicado no domínio atual, mas deixa de ser encontrado organicamente via Google, Bing e outros motores de busca. Usuários já cadastrados (com login e senha) acessam normalmente.

## O que será alterado

1. **Bloquear rastreamento em `public/robots.txt`**
   - Substituir `Allow: /` por `Disallow: /` para todos os `User-agent`.
   - Isso pede aos crawlers que não rastreiem nenhuma rota do app. (O app permanece acessível via link direto.)

2. **Adicionar meta tags de não indexação em `index.html`**
   - Incluir `<meta name="robots" content="noindex, nofollow, noarchive, noimageindex">`.
   - Incluir `<meta name="googlebot" content="noindex, nofollow, noarchive">`.
   - Incluir `<meta name="bingbot" content="noindex, nofollow, noarchive">`.
   - Essas tags instruem os motores de busca a não indexar a página, mesmo que algum link externo aponte para ela.

3. **Remover meta tags sociais que facilitam descoberta pública**
   - Remover `og:title`, `og:description`, `og:image`, `og:type`.
   - Remover `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`.
   - Essas tags são úteis para SEO/compartilhamento público; como o objetivo é ocultar, elas devem sair.

4. **Verificar e remover sitemap, se existir**
   - Verificar raiz do projeto e `public/` por `sitemap.xml` ou referências a sitemap.
   - Se existir, remover o arquivo e qualquer referência no `robots.txt`.

## O que não muda

- O app continua publicado no mesmo domínio.
- A tela de login continua acessível a quem souber o link.
- A autenticação continua exigindo usuário e senha cadastrados pelo administrador.
- O manifesto PWA (`manifest.json`) pode permanecer, pois não afeta a indexação por motores de busca.

## Validação

- O `robots.txt` final deve conter `User-agent: *` e `Disallow: /`.
- O `index.html` deve conter `noindex` no meta `robots` e não deve conter meta tags `og:` ou `twitter:`.
- Não deve haver sitemap publicado.
