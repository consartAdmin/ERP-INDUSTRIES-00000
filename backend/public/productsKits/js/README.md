# Products Kits — módulos frontend

No final do `productsKits.html`, mantenha o `core.js` e substitua:

```html
<script type="module" src="./productsKits.js"></script>
```

por:

```html
<script type="module" src="./js/productsKits.init.js"></script>
```

Somente o `productsKits.init.js` deve ser carregado diretamente pelo HTML.
Os outros módulos são importados automaticamente.

## Estrutura

- `productsKits.config.js`: rotas e configurações.
- `productsKits.state.js`: estado da tela e cache do DOM.
- `productsKits.utils.js`: formatação e utilitários.
- `productsKits.api.js`: chamadas à API.
- `productsKits.modal.js`: mensagens e confirmação.
- `productsKits.filters.js`: leitura dos filtros da lista.
- `productsKits.form.js`: leitura, preenchimento e limpeza do formulário.
- `productsKits.validation.js`: validações de kit e item.
- `productsKits.render.js`: tabelas, totais e estados visuais.
- `productsKits.products.js`: integração com a busca de produtos.
- `productsKits.actions.js`: ações e fluxo da tela.
- `productsKits.init.js`: eventos e inicialização.

## Compatibilidade com o HTML fornecido

O código aceita o HTML exatamente como foi enviado. O elemento
`#kitFormSection` é opcional: quando existir, controla a abertura e o fechamento
do formulário; quando não existir, o botão **Novo Kit** rola até `#formTitle`
sem causar erro.
