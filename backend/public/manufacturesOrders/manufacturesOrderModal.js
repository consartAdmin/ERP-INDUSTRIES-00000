// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: manufacturesOrderModal.js                                     ║
// ║ MODULE: Manufactures Orders                                         ║
// ║ DESCRIPTION: Modal Pedido para Fabricante                           ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

let created = false;

export function createManufacturesOrderModal() {
  if (created) return;

  const mount =
    document.getElementById('manufacturesOrderModalMount') ||
    document.body;

  mount.insertAdjacentHTML('beforeend', getModalHtml());

  created = true;
}

export function openManufacturesOrderModal() {
  document.getElementById('orderModal')?.classList.remove('hidden');
}

export function closeManufacturesOrderModal() {
  document.getElementById('orderModal')?.classList.add('hidden');
}

function getModalHtml() {
  return `
    <div class="modal-overlay hidden" id="orderModal">
      <div class="modal modal-xl">

        <div class="modal-header">
          <div>
            <h2>
              <i class="fa-solid fa-industry"></i>
              Pedido para Fabricante
            </h2>

            <p>
              Controle completo de produção/compras com sugestão por estoque mínimo e máximo.
            </p>
          </div>

          <button class="modal-close" id="btnCloseModal" type="button" title="Fechar">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="modal-body">

          <div class="form-grid form-grid-header">

            <div class="field">
              <label for="orderNumber">Número Pedido</label>
              <input type="text" id="orderNumber" readonly />
            </div>

            <div class="field">
              <label for="orderStatus">Status</label>
              <select id="orderStatus">
                <option value="OPEN">ABERTO</option>
                <option value="IN_PROGRESS">EM PRODUÇÃO</option>
                <option value="FINISHED">FINALIZADO</option>
                <option value="CANCELLED">CANCELADO</option>
              </select>
            </div>

            <div class="field manufacturer-field">
              <label for="manufacturerName">Fabricante</label>

              <div class="manufacturer-search-line">
                <input type="text" id="manufacturerName" placeholder="Nome fabricante..." readonly />

                <button type="button" class="btn btn-toolbar btn-sm" id="btnSearchManufacturer" title="Buscar fabricante">
                  <i class="fa-solid fa-magnifying-glass"></i>
                </button>
              </div>
            </div>

            <div class="field">
              <label for="manufacturerImportFilter">Filtro de Importação</label>
              <select id="manufacturerImportFilter">
                <option value="all">Todos</option>
                <option value="stock_gt_zero">Somente com estoque &gt; 0</option>
                <option value="below_min">Abaixo do mínimo</option>
                <option value="above_max">Acima do máximo</option>
                <option value="inside_range">Dentro do intervalo</option>
              </select>
            </div>

            <div class="field apply-filter-field">
              <label>&nbsp;</label>

              <button type="button" class="btn btn-toolbar btn-sm" id="btnApplyManufacturerFilter">
                <i class="fa-solid fa-filter"></i>
                Aplicar Filtro
              </button>
            </div>

            <div class="field field-full">
              <label for="orderNotes">Observações</label>
              <textarea id="orderNotes" rows="3" placeholder="Observações do pedido..."></textarea>
            </div>

          </div>

          <div class="products-box">
            <div class="products-header">
              <h3>
                <i class="fa-solid fa-box-open"></i>
                Produtos do Pedido
              </h3>
            </div>

            <div class="product-search-card">
              <div class="search-row">

                <div class="field field-2x">
                  <label for="productSearch">Buscar Produto</label>

                  <div class="search-input">
                    <i class="fa-solid fa-barcode"></i>
                    <input
                      type="text"
                      id="productSearch"
                      placeholder="SKU, código barras ou descrição..."
                      autocomplete="off"
                    />
                  </div>

                  <div class="autocomplete-list hidden" id="productAutocomplete"></div>
                </div>

                <div class="field">
                  <label for="productQuantity">Quantidade</label>
                  <input type="number" id="productQuantity" min="1" step="1" value="1" />
                </div>

                <div class="field">
                  <label for="productCost">Custo</label>
                  <input type="number" id="productCost" min="0" step="0.01" />
                </div>

                <div class="field add-button-field">
                  <button id="btnAddProduct" class="btn btn-toolbar btn-sm" type="button">
                    <i class="fa-solid fa-plus"></i>
                    Adicionar
                  </button>
                </div>

              </div>
            </div>

            <div class="items-table-wrapper">
              <table class="erp-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Descrição</th>
                    <th>U.M</th>
                    <th>Estoque</th>
                    <th>Mín.</th>
                    <th>Máx.</th>
                    <th>Qtd</th>
                    <th>Custo</th>
                    <th>Total</th>
                    <th width="80">Ações</th>
                  </tr>
                </thead>

                <tbody id="itemsTableBody">
                  <!-- JS -->
                </tbody>
              </table>
            </div>

            <div class="totals-area">
              <div class="total-box">
                <span>Total Geral</span>
                <strong id="modalTotalCost">R$ 0,00</strong>
              </div>
            </div>
          </div>

        </div>

        <div class="modal-footer">
          <button class="btn btn-toolbar btn-sm" id="btnCancelModal" type="button">
            <i class="fa-solid fa-xmark"></i>
            Cancelar
          </button>

          <button class="btn btn-toolbar btn-sm" id="btnSaveOrder" type="button">
            <i class="fa-solid fa-floppy-disk"></i>
            Salvar Pedido
          </button>
        </div>

      </div>
    </div>
  `;
}