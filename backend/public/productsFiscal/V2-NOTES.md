# Products Fiscal V2

The active page is `productsFiscal.html`, which loads
`js/productsFiscal.init.js`.

It now uses:

- `GET /api/v2/products-fiscal`
- `PUT /api/v2/products-fiscal/current`
- `GET /api/v2/fiscal-profiles/:id`

The save payload contains only `product_code`, `fiscal_classification_id`,
source metadata and an optional product reference inside `extra_payload`.
The fiscal profile is resolved by the API through the selected classification.

The shared `/public/modalsSearch/fiscalClassificationModalSearch.js` must list
records from `/api/v2/fiscal-classifications`. That shared file is external to
this archive and therefore was not modified here.

`produtosFiscalLote.html`, `produtosFiscalLote.js` and
`produtosFiscalLote.css` are retained as legacy batch files. They require a
separate V2 batch endpoint before they can be enabled with the new model.
