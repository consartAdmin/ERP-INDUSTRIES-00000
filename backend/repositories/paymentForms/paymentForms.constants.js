// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentForms.constants.js — Tabela / PK dos meios de pagamento     ║
// ║ Tabela: public."paymentForms"                                      ║
// ║   - paymentForms_id (PK, SERIAL)                                   ║
// ║   - name            VARCHAR(50)                                    ║
// ║   - nfe_tpag        CHAR(2)   → código tPag NF-e                   ║
// ║   - active          BOOLEAN                                        ║
// ║   - created_at      TIMESTAMP                                      ║
// ║   - updated_at      TIMESTAMP                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TABLE = 'public."paymentForms"';
export const PK = '"paymentForms_id"';
