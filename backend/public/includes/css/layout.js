/* ╔══════════════════════════════════════════════════════════════════════════════╗
   ║ 🎨 layout.js — Manual do Design System PRODNEX ERP                           ║
   ║ ---------------------------------------------------------------------------- ║
   ║ Este arquivo explica a função e escopo de cada arquivo CSS da arquitetura    ║
   ║ visual do sistema CONSART. Serve como referência rápida para manutenção,     ║
   ║ expansão de estilos e criação de novas páginas com o mesmo padrão visual.    ║
   ╚══════════════════════════════════════════════════════════════════════════════╝ */

/* ──────────────────────────────────────────────────────────────────────────────
   📘 base.css
   ------------------------------------------------------------------------------ 
   - Responsável por: resetar estilos padrão e definir tokens globais.
   - Define todas as variáveis CSS (cores, espaçamentos, fontes, sombras, etc.).
   - Inclui suporte automático a modo claro/escuro via `prefers-color-scheme`.
   - Configura tipografia padrão (fonte Inter) e suavização de fontes.
   - Define também seletores utilitários para `::selection`, `scrollbar`, etc.

   📁 Caminho: /public/includes/css/base.css
   ────────────────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────────────────
   🧩 layout.css
   ------------------------------------------------------------------------------ 
   - Controla toda a estrutura e posicionamento do layout.
   - Define containers (`.c-container`), colunas (`.row`, `.stack`), espaçamentos
     verticais, e comportamento flexível do `.c-page` e `.c-main`.
   - Estiliza o menu principal `.menu-principal` com efeito de blur e sticky.
   - Inclui regras para cartões de seção (`.section-card`) e grids responsivos.

   📁 Caminho: /public/includes/css/layout.css
   ────────────────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────────────────
   🧱 components.css
   ------------------------------------------------------------------------------ 
   - Define todos os componentes reutilizáveis de interface (UI Kit).
   - Inclui botões (`.btn`, `.btn-success`, `.btn-outline`, `.btn-danger`, etc.),
     badges (`.badge.ok`, `.badge.off`, `.badge.warn`), inputs, selects, labels,
     cards, tabelas e paginação.
   - Contém também o estilo padrão de campos de formulário e áreas de status.
   - Garante consistência visual entre todos os módulos (clientes, produtos, etc.).

   📁 Caminho: /public/includes/css/components.css
   ────────────────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────────────────
   📄 pages.css
   ------------------------------------------------------------------------------ 
   - Responsável por ajustes específicos e hooks por página.
   - Usa classes como `.page-products`, `.page-edit-product`, `.page-budgets`, etc.
   - Define tamanhos de colunas, margens e pequenas diferenças visuais por tela.
   - Inclui também regras para impressão (`@media print`) para relatórios e PDFs.

   📁 Caminho: /public/includes/css/pages.css
   ────────────────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────────────────
   🧭 style.css
   ------------------------------------------------------------------------------ 
   - Arquivo agregador que importa todos os anteriores.
   - Serve como ponto único de entrada global de estilos.
   - Útil para ambientes de produção (menos requisições HTTP).
   - Mantém a ordem correta dos arquivos: base → layout → components → pages.

   📁 Caminho: /public/includes/css/style.css
   ────────────────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────────────────
   🧮 products.css (exemplo de CSS local)
   ------------------------------------------------------------------------------ 
   - CSS de escopo local, usado apenas pela página `/public/products/products.html`.
   - Serve para microajustes de espaçamento, responsividade ou variações sutis
     que não precisam afetar o design global.
   - Pode conter ajustes como largura do campo de busca, cor do botão Voltar, etc.

   📁 Caminho: /public/products/products.css
   ────────────────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────────────────
   💡 Dicas de uso
   ------------------------------------------------------------------------------ 
   - Em desenvolvimento: importe cada CSS separadamente no HTML.
     Exemplo:
       <link rel="stylesheet" href="/public/includes/css/base.css">
       <link rel="stylesheet" href="/public/includes/css/layout.css">
       <link rel="stylesheet" href="/public/includes/css/components.css">
       <link rel="stylesheet" href="/public/includes/css/pages.css">

   - Em produção: use apenas o `style.css` consolidado:
       <link rel="stylesheet" href="/public/includes/css/style.css">

   - Para criar novas páginas:
       1. Adicione `class="consart-theme c-page page-nome"` ao <body>.
       2. Use containers padrão `.c-container`, `.row`, `.section-card`.
       3. Use botões e tabelas conforme definidos em components.css.
       4. Crie um CSS local (ex: `/public/nome/nome.css`) apenas se necessário.

   - O padrão visual garante:
       🎨 Paleta azul CONSART (azul-600 / azul-700)
       🌙 Dark mode automático
       📏 Layout fluido e responsivo
       ⚙️ Reutilização total entre módulos
       📄 Impressão formatada
   ────────────────────────────────────────────────────────────────────────────── */
