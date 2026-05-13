## Ícone próprio (foguete) + suporte a Web App no iPhone e Dock do Mac

### Problema
- O app não possui favicon próprio (usa o genérico do Lovable).
- Ao salvar como Web App no iPhone, não aparece ícone nenhum.
- Ao salvar no Dock do Mac, aparece o ícone do Lovable.

### Solução
Gerar um ícone de foguete minimalista e configurar todos os metadados necessários para navegadores, iOS e macOS.

### Passos

1. **Gerar imagens do ícone**
   - Criar ícone de foguete em estilo flat/minimalista, sem referência ao Lovable.
   - Gerar variações nos tamanhos necessários:
     - `favicon-32x32.png` — aba do navegador
     - `apple-touch-icon.png` (180×180) — iPhone/iPad Home Screen e Dock do Mac
     - `icon-192x192.png` — manifest PWA
     - `icon-512x512.png` — manifest PWA (splash screens)
   - Remover o `favicon.ico` genérico existente em `public/`.

2. **Criar `public/manifest.json`**
   - Configurar como PWA: `name`, `short_name`, `start_url`, `display: standalone`, `theme_color`, `background_color`.
   - Referenciar os ícones 192×192 e 512×512.

3. **Atualizar `index.html`**
   - Adicionar `<link rel="icon" type="image/png" href="/favicon-32x32.png">`.
   - Adicionar `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.
   - Adicionar `<link rel="manifest" href="/manifest.json">`.
   - Adicionar meta tags para iOS/macOS:
     - `apple-mobile-web-app-capable: yes`
     - `apple-mobile-web-app-status-bar-style: black-translucent`
     - `apple-mobile-web-app-title: EZO Urologia`
     - `theme-color` (cor da barra de status e navegador)
   - Remover/atualizar metadados que referenciam "Lovable" (author, twitter:site, etc.) para não deixar rastros.

4. **Verificar** (pós-implementação)
   - Validar que `public/` contém apenas os novos ícones e o manifest.
   - Confirmar que não há mais referências ao Lovable nos metadados do `index.html`.

### Notas técnicas
- Nenhuma dependência extra é necessária (configuração puramente estática).
- O Vite já serve arquivos em `public/` na raiz automaticamente.
- `theme-color` será definida para combinar com a identidade visual do app (azul escuro ou cor primária do projeto).