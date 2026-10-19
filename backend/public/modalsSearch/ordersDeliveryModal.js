// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersDeliveryModal.js — Modal Frete/Entrega (ESM) — PRODNEX ERP     ║
// ║ Compatível com ordersDeliveryModal.css (.odm-*)                       ║
// ║ Retorna Promise: { ok:true, data } | { ok:false, cancelled:true }     ║
// ║ ✅ Busca Transportadora via transportersModalSearch.js                ║
// ║ ✅ Mantém carrier_id + snapshot dos dados da transportadora           ║
// ║ ✅ Preserva preenchimento manual dos campos após a importação          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  openTransportersModalSearch,
} from '/public/modalsSearch/transportersModalSearch.js';

const DEFAULTS = Object.freeze({
  freight_value: 0,
  freight_mode: 9,

  vehicle_plate: '',
  vehicle_state: '',
  vehicle_uf: '',
  vehicle_rntc: '',

  carrier_id: null,
  carrier_name: '',
  carrier_cnpj_cpf: '',
  carrier_ie: '',
  carrier_address: '',
  carrier_number: '',
  carrier_complement: '',
  carrier_district: '',
  carrier_city: '',
  carrier_state: '',
  carrier_uf: '',
  carrier_zipcode: '',

  volumes: 0,
  volume_quantity: 0,
  volume_species: '',
  volume_brand: '',
  volume_numbering: '',
  gross_weight: 0,
  net_weight: 0,

  notes: '',
});

function getApiBase() {
  return (
    window.apiBase ||
    window.API_BASE ||
    window.location.origin
  ).replace(/\/$/, '');
}

function toNum(v, fallback = 0) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeDoc(v) {
  return String(v || '')
    .replace(/\D+/g, '')
    .slice(0, 14);
}

function sanitizeZip(v) {
  return String(v || '')
    .replace(/\D+/g, '')
    .slice(0, 8);
}

function upperUF(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

function upperPlate(v) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .slice(0, 8);
}

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function removeIfExists() {
  document.getElementById('odmBackdrop')?.remove();
  document.getElementById('odmModalRoot')?.remove();
}

function setInputValue(root, selector, value) {
  const el = root.querySelector(selector);
  if (!el) return;
  el.value = value ?? '';
}

function buildDom(initial) {
  const vehicleUF =
    initial.vehicle_state ??
    initial.vehicle_uf ??
    '';

  const carrierUF =
    initial.carrier_state ??
    initial.carrier_uf ??
    '';

  const qtdVolumes =
    initial.volumes ??
    initial.volume_quantity ??
    0;

  const backdrop = document.createElement('div');
  backdrop.className = 'odm-backdrop';
  backdrop.id = 'odmBackdrop';

  const modalRoot = document.createElement('div');
  modalRoot.className = 'odm-modal';
  modalRoot.id = 'odmModalRoot';

  modalRoot.innerHTML = `
<div class="odm-card">
  <div class="modal__dialog modal-height-10 modal-width-8">
    <section
      class="modal__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="formTitle"
      aria-describedby="formDescription"
    >

      <!-- ===================================================== -->
      <!-- HEADER                                                -->
      <!-- ===================================================== -->
      <header class="modal__header modal-header-color-3">
        <div>
          <h2 id="formTitle">Frete / Entrega</h2>

          <p id="formDescription">
            Informe o valor do frete e os dados do transportador.
          </p>
        </div>

        <div class="btn-inline">
          <button
            type="button"
            class="btn btn-clean btn-sm"
            data-close-modal="freightModal"
            aria-label="Fechar"
            title="Fechar"
          >
            ×
          </button>
        </div>
      </header>

      <!-- ===================================================== -->
      <!-- BODY                                                  -->
      <!-- ===================================================== -->
      <div class="odm-body">

        <!-- FRETE -->
        <div class="fields-inline fields-gap-3">

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_freight_value">Valor do frete (R$)</label>

            <input
              id="odm_freight_value"
              inputmode="decimal"
              value="${esc(
    String(initial.freight_value ?? 0).replace('.', ',')
  )}"
            />
          </div>

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_freight_mode">Modalidade</label>

            <select id="odm_freight_mode">
              <option value="0">0 - Emitente</option>
              <option value="1">1 - Destinatário</option>
              <option value="2">2 - Terceiros</option>
              <option value="9">9 - Sem frete</option>
            </select>
          </div>

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_vehicle_plate">Placa</label>

            <input
              id="odm_vehicle_plate"
              value="${esc(upperPlate(initial.vehicle_plate))}"
              placeholder="ABC1D23"
            />
          </div>

          <div class="fields fields-h-6 fields-w-5 fields-font-3">
            <label for="odm_vehicle_state">UF</label>

            <input
              id="odm_vehicle_state"
              value="${esc(upperUF(vehicleUF))}"
              placeholder="MG"
              maxlength="2"
            />
          </div>

        </div>

        <!-- ===================================================== -->
        <!-- TRANSPORTADOR                                         -->
        <!-- ===================================================== -->
        <div class="fields-inline">
          <div class="fields fields-h-5 fields-w-15 fields-font-3">
            <h3>Transportador</h3>
          </div>
        </div>

        <input
          type="hidden"
          id="odm_carrier_id"
          value="${esc(initial.carrier_id ?? '')}"
        />

        <div class="fields-inline fields-gap-3">

          <div class="fields fields-h-6 fields-w-30 fields-font-3">
            <label for="odm_carrier_name">Nome / Razão social</label>

            <div class="fields-inline fields-gap-1">

              <input
                id="odm_carrier_name"
                value="${esc(initial.carrier_name)}"
                placeholder="Transportadora..."
                autocomplete="off"
              />

              <button
                type="button"
                id="btnOdmCarrierSearch"
                class="btn btn-search btn-h-5 btn-w-2"
                title="Buscar transportadora"
                aria-label="Buscar transportadora"
              >
                <i>🔎</i>
              </button>

            </div>
          </div>

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_carrier_doc">CNPJ/CPF</label>

            <input
              id="odm_carrier_doc"
              inputmode="numeric"
              value="${esc(
    sanitizeDoc(initial.carrier_cnpj_cpf)
  )}"
            />
          </div>

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_carrier_ie">IE</label>

            <input
              id="odm_carrier_ie"
              value="${esc(initial.carrier_ie)}"
              placeholder="Inscrição Estadual"
            />
          </div>

        </div>

        <!-- ENDEREÇO -->
        <div class="fields-inline fields-gap-3">

          <div class="fields fields-h-6 fields-w-20 fields-font-3">
            <label for="odm_carrier_address">Endereço</label>

            <input
              id="odm_carrier_address"
              value="${esc(initial.carrier_address)}"
              placeholder="Rua..."
            />
          </div>

          <div class="fields fields-h-6 fields-w-5 fields-font-3">
            <label for="odm_carrier_number">Número</label>

            <input
              id="odm_carrier_number"
              value="${esc(initial.carrier_number)}"
              placeholder="Nº"
            />
          </div>

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_carrier_complement">Complemento</label>

            <input
              id="odm_carrier_complement"
              value="${esc(initial.carrier_complement)}"
              placeholder="Complemento..."
            />
          </div>

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_carrier_district">Bairro</label>

            <input
              id="odm_carrier_district"
              value="${esc(initial.carrier_district)}"
              placeholder="Bairro..."
            />
          </div>

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_carrier_city">Cidade</label>

            <input
              id="odm_carrier_city"
              value="${esc(initial.carrier_city)}"
              placeholder="Cidade"
            />
          </div>
        </div> 

         <div class="fields-inline fields-gap-3">
          <div class="fields fields-h-6 fields-w-5 fields-font-3">
            <label for="odm_carrier_state">UF</label>

            <input
              id="odm_carrier_state"
              value="${esc(upperUF(carrierUF))}"
              placeholder="MG"
              maxlength="2"
            />
          </div>

          <div class="fields fields-h-6 fields-w-8 fields-font-3">
            <label for="odm_carrier_zipcode">CEP</label>

            <input
              id="odm_carrier_zipcode"
              inputmode="numeric"
              value="${esc(
    sanitizeZip(initial.carrier_zipcode)
  )}"
              placeholder="30170012"
            />
          </div>

        </div>

        <!-- ===================================================== -->
        <!-- VEÍCULO                                               -->
        <!-- ===================================================== -->
        <div class="fields-inline">
          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <h3>Veículo</h3>
          </div>
        </div>

        <div class="fields-inline fields-gap-3">

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_vehicle_rntc">RNTRC</label>

            <input
              id="odm_vehicle_rntc"
              value="${esc(initial.vehicle_rntc)}"
              placeholder="RNTRC..."
            />
          </div>

        </div>

        <!-- ===================================================== -->
        <!-- VOLUMES                                               -->
        <!-- ===================================================== -->
        <div class="fields-inline fields-gap-3">
          <div class="fields fields-h-5 fields-w-20 fields-font-3">
            <h3>Volumes transportados</h3>
          </div>
        </div>

        <div class="fields-inline fields-gap-3">

          <div class="fields fields-h-6 fields-w-5 fields-font-3">
            <label for="odm_volumes">Qtd volumes</label>

            <input
              id="odm_volumes"
              type="number"
              min="0"
              step="1"
              value="${Number(qtdVolumes || 0)}"
            />
          </div>

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_volume_species">Espécie</label>

            <input
              id="odm_volume_species"
              value="${esc(initial.volume_species)}"
              placeholder="Caixas..."
            />
          </div>

          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <label for="odm_volume_brand">Marca</label>

            <input
              id="odm_volume_brand"
              value="${esc(initial.volume_brand)}"
              placeholder="Marca..."
            />
          </div>

          <div class="fields fields-h-6 fields-w-10 fields-font-3">
            <label for="odm_volume_numbering">Numeração</label>

            <input
              id="odm_volume_numbering"
              value="${esc(initial.volume_numbering)}"
              placeholder="Numeração..."
            />
          </div>

          <div class="fields fields-h-6 fields-w-8 fields-font-3">
            <label for="odm_gross_weight">Peso bruto (kg)</label>

            <input
              id="odm_gross_weight"
              inputmode="decimal"
              value="${esc(
    String(initial.gross_weight ?? 0).replace('.', ',')
  )}"
            />
          </div>

          <div class="fields fields-h-6 fields-w-8 fields-font-3">
            <label for="odm_net_weight">Peso líquido (kg)</label>

            <input
              id="odm_net_weight"
              inputmode="decimal"
              value="${esc(
    String(initial.net_weight ?? 0).replace('.', ',')
  )}"
            />
          </div>

        </div>

        <!-- ===================================================== -->
        <!-- OBSERVAÇÕES                                           -->
        <!-- ===================================================== -->
        <div class="fields-inline">
          <div class="fields fields-h-6 fields-w-15 fields-font-3">
            <h3>Observações</h3>
          </div>
        </div>

        <div class="fields-inline">
          <div class="fields fields-h-5 fields-w-full fields-font-3">

            <textarea
              id="odm_notes"
              rows="3"
              placeholder="Observações do frete / entrega..."
            >${esc(initial.notes)}</textarea>

          </div>
        </div>

      </div>

      <!-- ===================================================== -->
      <!-- FOOTER                                                -->
      <!-- ===================================================== -->
      <footer class="modal__footer modal-footer-color-3">

        <button
          class="btn btn-new btn-sm"
          type="button"
          data-close-modal="freightModal"
        >
          Cancelar
        </button>

        <button
          id="btnSaveFreight"
          class="btn btn-save btn-sm"
          type="button"
        >
          Salvar Frete
        </button>

      </footer>

    </section>
  </div>
</div>
  `;

  queueMicrotask(() => {
    const sel =
      modalRoot.querySelector(
        '#odm_freight_mode'
      );

    if (sel) {
      sel.value =
        String(
          initial.freight_mode ?? 9
        );
    }
  });

  return {
    backdrop,
    modalRoot,
  };
}

function applyTransporterToModal(
  root,
  transporter = {}
) {
  const carrierId =
    transporter.transporter_id ??
    transporter.id ??
    null;

  const carrierName =
    transporter.legal_name ||
    transporter.name ||
    transporter.trade_name ||
    transporter.razao_social ||
    '';

  const carrierDoc =
    transporter.cnpj_cpf ||
    transporter.cpf_cnpj ||
    transporter.tax_id ||
    transporter.document ||
    transporter.cnpj ||
    transporter.cpf ||
    '';

  const carrierIe =
    transporter.state_registration ||
    transporter.inscricao_estadual ||
    transporter.ie ||
    '';

  const carrierAddress =
    transporter.street ||
    transporter.logradouro ||
    transporter.address ||
    '';

  const carrierNumber =
    transporter.address_number ||
    transporter.street_number ||
    transporter.number ||
    transporter.numero ||
    transporter.numero_endereco ||
    '';

  const carrierComplement =
    transporter.complement ||
    transporter.complemento ||
    '';

  const carrierDistrict =
    transporter.neighborhood ||
    transporter.bairro ||
    transporter.district ||
    '';

  const carrierCity =
    transporter.city ||
    transporter.cidade ||
    '';

  const carrierState =
    transporter.uf ||
    transporter.state ||
    transporter.estado ||
    '';

  const carrierZipcode =
    transporter.zip_code ||
    transporter.postal_code ||
    transporter.cep ||
    '';

  const vehicleRntc =
    transporter.rntrc ||
    transporter.rntc ||
    transporter.antt ||
    '';

  setInputValue(
    root,
    '#odm_carrier_id',
    carrierId
  );

  setInputValue(
    root,
    '#odm_carrier_name',
    carrierName
  );

  setInputValue(
    root,
    '#odm_carrier_doc',
    sanitizeDoc(carrierDoc)
  );

  setInputValue(
    root,
    '#odm_carrier_ie',
    carrierIe
  );

  setInputValue(
    root,
    '#odm_carrier_address',
    carrierAddress
  );

  setInputValue(
    root,
    '#odm_carrier_number',
    carrierNumber
  );

  setInputValue(
    root,
    '#odm_carrier_complement',
    carrierComplement
  );

  setInputValue(
    root,
    '#odm_carrier_district',
    carrierDistrict
  );

  setInputValue(
    root,
    '#odm_carrier_city',
    carrierCity
  );

  setInputValue(
    root,
    '#odm_carrier_state',
    upperUF(carrierState)
  );

  setInputValue(
    root,
    '#odm_carrier_zipcode',
    sanitizeZip(carrierZipcode)
  );

  setInputValue(
    root,
    '#odm_vehicle_rntc',
    vehicleRntc
  );

  return {
    carrier_id:
      carrierId,

    carrier_name:
      carrierName,

    carrier_cnpj_cpf:
      sanitizeDoc(carrierDoc),

    carrier_ie:
      String(carrierIe || '').trim(),

    carrier_address:
      String(carrierAddress || '').trim(),

    carrier_number:
      String(carrierNumber || '').trim(),

    carrier_complement:
      String(carrierComplement || '').trim(),

    carrier_district:
      String(carrierDistrict || '').trim(),

    carrier_city:
      String(carrierCity || '').trim(),

    carrier_state:
      upperUF(carrierState),

    carrier_zipcode:
      sanitizeZip(carrierZipcode),

    vehicle_rntc:
      String(vehicleRntc || '').trim(),
  };
}

function collectData(root) {
  const $ =
    (sel) => root.querySelector(sel);

  const vehicleState =
    upperUF(
      $('#odm_vehicle_state')?.value
    );

  const carrierState =
    upperUF(
      $('#odm_carrier_state')?.value
    );

  const volumes =
    Math.max(
      0,
      Math.floor(
        toNum(
          $('#odm_volumes')?.value,
          0
        )
      )
    );

  const carrierIdRaw =
    String(
      $('#odm_carrier_id')?.value ??
      ''
    ).trim();

  return {
    freight_value:
      toNum(
        $('#odm_freight_value')?.value,
        0
      ),

    freight_mode:
      Number(
        $('#odm_freight_mode')?.value ??
        9
      ),

    // =========================================================
    // VEÍCULO
    // =========================================================
    vehicle_plate:
      upperPlate(
        $('#odm_vehicle_plate')?.value
      ),

    vehicle_state:
      vehicleState,

    vehicle_uf:
      vehicleState,

    vehicle_rntc:
      String(
        $('#odm_vehicle_rntc')?.value ||
        ''
      ).trim(),

    // =========================================================
    // TRANSPORTADORA
    // =========================================================
    carrier_id:
      carrierIdRaw || null,

    carrier_name:
      String(
        $('#odm_carrier_name')?.value ||
        ''
      ).trim(),

    carrier_cnpj_cpf:
      sanitizeDoc(
        $('#odm_carrier_doc')?.value ||
        ''
      ),

    carrier_ie:
      String(
        $('#odm_carrier_ie')?.value ||
        ''
      ).trim(),

    carrier_address:
      String(
        $('#odm_carrier_address')?.value ||
        ''
      ).trim(),

    carrier_number:
      String(
        $('#odm_carrier_number')?.value ||
        ''
      ).trim(),

    carrier_complement:
      String(
        $('#odm_carrier_complement')?.value ||
        ''
      ).trim(),

    carrier_district:
      String(
        $('#odm_carrier_district')?.value ||
        ''
      ).trim(),

    carrier_city:
      String(
        $('#odm_carrier_city')?.value ||
        ''
      ).trim(),

    carrier_state:
      carrierState,

    carrier_uf:
      carrierState,

    carrier_zipcode:
      sanitizeZip(
        $('#odm_carrier_zipcode')?.value ||
        ''
      ),

    // =========================================================
    // VOLUMES
    // =========================================================
    volumes,

    volume_quantity:
      volumes,

    volume_species:
      String(
        $('#odm_volume_species')?.value ||
        ''
      ).trim(),

    volume_brand:
      String(
        $('#odm_volume_brand')?.value ||
        ''
      ).trim(),

    volume_numbering:
      String(
        $('#odm_volume_numbering')?.value ||
        ''
      ).trim(),

    gross_weight:
      toNum(
        $('#odm_gross_weight')?.value,
        0
      ),

    net_weight:
      toNum(
        $('#odm_net_weight')?.value,
        0
      ),

    notes:
      String(
        $('#odm_notes')?.value ||
        ''
      ).trim(),
  };
}

export function openOrdersDeliveryModal(
  input = {}
) {
  removeIfExists();

  const initial = {
    ...DEFAULTS,
    ...(input || {}),
  };

  const {
    backdrop,
    modalRoot,
  } = buildDom(initial);

  return new Promise((resolve) => {

    let settled = false;

    const cleanup = () => {
      document.removeEventListener(
        'keydown',
        onKey
      );

      backdrop.remove();
      modalRoot.remove();
    };

    const finishCancel = () => {
      if (settled) return;
      settled = true;

      cleanup();

      resolve({
        ok: false,
        cancelled: true,
      });
    };

    const finishSave = () => {
      if (settled) return;

      try {
        const data =
          collectData(modalRoot);

        settled = true;

        cleanup();

        resolve({
          ok: true,
          data,
        });

      } catch (err) {
        console.error(
          '[ordersDeliveryModal] finishSave error:',
          err
        );

        settled = true;

        cleanup();

        resolve({
          ok: false,
          cancelled: true,
        });
      }
    };

    const onKey = (e) => {
      /*
       * Quando o modal de busca de transportadoras estiver aberto,
       * ele próprio controla o ESC.
       *
       * Assim evitamos fechar o Frete/Entrega junto com a busca.
       */
      if (
        document.getElementById(
          'transportersModalSearchOverlay'
        )
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();

        finishCancel();
      }
    };

    // =========================================================
    // FECHAR / CANCELAR
    // =========================================================
    backdrop.addEventListener(
      'click',
      finishCancel
    );

    const card =
      modalRoot.querySelector(
        '.odm-card'
      );

    card?.addEventListener(
      'click',
      (e) => e.stopPropagation()
    );

    modalRoot
      .querySelectorAll(
        '[data-close-modal="freightModal"]'
      )
      .forEach((button) => {
        button.addEventListener(
          'click',
          (e) => {
            e.preventDefault();
            e.stopPropagation();

            finishCancel();
          }
        );
      });

    // =========================================================
    // BUSCAR TRANSPORTADORA
    // =========================================================
    modalRoot
      .querySelector(
        '#btnOdmCarrierSearch'
      )
      ?.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          e.stopPropagation();

          openTransportersModalSearch({
            apiBase:
              `${getApiBase()}/api/transporters`,

            onPick(transporter) {
              console.log(
                '[ordersDeliveryModal][transporter-picked]',
                transporter
              );

              const imported =
                applyTransporterToModal(
                  modalRoot,
                  transporter
                );

              /*
               * Mantemos o objeto initial sincronizado apenas
               * como referência interna do modal.
               *
               * O dado oficial retornado será coletado do DOM
               * no momento de "Salvar Frete".
               */
              Object.assign(
                initial,
                imported
              );

              modalRoot
                .querySelector(
                  '#odm_carrier_name'
                )
                ?.focus();
            },
          });
        }
      );

    // =========================================================
    // NORMALIZAÇÃO VISUAL
    // =========================================================
    modalRoot
      .querySelector(
        '#odm_vehicle_plate'
      )
      ?.addEventListener(
        'input',
        (e) => {
          e.currentTarget.value =
            upperPlate(
              e.currentTarget.value
            );
        }
      );

    modalRoot
      .querySelector(
        '#odm_vehicle_state'
      )
      ?.addEventListener(
        'input',
        (e) => {
          e.currentTarget.value =
            upperUF(
              e.currentTarget.value
            );
        }
      );

    modalRoot
      .querySelector(
        '#odm_carrier_state'
      )
      ?.addEventListener(
        'input',
        (e) => {
          e.currentTarget.value =
            upperUF(
              e.currentTarget.value
            );
        }
      );

    modalRoot
      .querySelector(
        '#odm_carrier_doc'
      )
      ?.addEventListener(
        'input',
        (e) => {
          e.currentTarget.value =
            sanitizeDoc(
              e.currentTarget.value
            );
        }
      );

    modalRoot
      .querySelector(
        '#odm_carrier_zipcode'
      )
      ?.addEventListener(
        'input',
        (e) => {
          e.currentTarget.value =
            sanitizeZip(
              e.currentTarget.value
            );
        }
      );

    // =========================================================
    // SALVAR
    // =========================================================
    modalRoot
      .querySelector(
        '#btnSaveFreight'
      )
      ?.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          e.stopPropagation();

          finishSave();
        }
      );

    document.addEventListener(
      'keydown',
      onKey
    );

    document.body.appendChild(
      backdrop
    );

    document.body.appendChild(
      modalRoot
    );

    modalRoot
      .querySelector(
        '#odm_freight_value'
      )
      ?.focus();
  });
}

