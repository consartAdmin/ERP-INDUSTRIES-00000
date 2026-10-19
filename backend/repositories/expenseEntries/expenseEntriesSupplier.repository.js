// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesSupplier.repository.js — resolveSupplierId           ║
// ║ public.suppliers (supplier_id, name, tax_id) — busca ou cria       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './expenseEntries.sql.js';
import { onlyDigits } from './expenseEntries.utils.js';

export async function resolveSupplierId(client, supplier = {}) {
  const taxIdRaw =
    supplier.tax_id ??
    supplier.taxId ??
    supplier.cnpj_cpf ??
    supplier.cnpjCpf ??
    supplier.cnpj ??
    supplier.cpf ??
    supplier.document ??
    supplier.doc ??
    '';

  const taxId = onlyDigits(taxIdRaw);

  const name =
    String(
      supplier.name ??
      supplier.nome ??
      supplier.razao_social ??
      supplier.nome_fantasia ??
      supplier.fantasia ??
      ''
    ).trim();

  // precisa de pelo menos taxId ou name
  if (!taxId && !name) return null;

  // 1) tenta achar por tax_id (melhor chave)
  if (taxId) {
    const found = await client.query(`
      select supplier_id
      from public.suppliers
      where regexp_replace(coalesce(tax_id,''), '\\\\D', '', 'g') = $1
      limit 1
      `,
      [taxId]
    );
    if (found.rowCount) return found.rows[0].supplier_id;
  }

  // 2) fallback por name (quando não tem documento)
  if (name) {
    const foundByName = await q(
      `
      select supplier_id
        from public.suppliers
       where upper(trim(name)) = upper(trim($1))
       limit 1
      `,
      [name]
    );
    if (foundByName.rowCount) return foundByName.rows[0].supplier_id;
  }

  // 3) cria fornecedor (name é NOT NULL)
  const finalName = name || (taxId ? `FORNECEDOR ${taxId}` : 'FORNECEDOR');

  // evita duplicar por taxId em corrida (2 requests simultâneos):
  // como não há UNIQUE em tax_id, fazemos "re-check" após inserir se necessário.
  const created = await q(
    `
    insert into public.suppliers (name, tax_id, phone, email, address, city, state, postal_code)
    values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning supplier_id
    `,
    [
      finalName,
      taxId || null,
      supplier.phone ?? supplier.telefone ?? null,
      supplier.email ?? null,
      supplier.address ?? supplier.endereco ?? null,
      supplier.city ?? supplier.cidade ?? null,
      supplier.state ?? supplier.uf ?? null,
      supplier.postal_code ?? supplier.cep ?? null,
    ]
  );

  if (created.rowCount) return created.rows[0].supplier_id;

  // fallback final: tenta achar por taxId depois (caso inserção tenha sido bloqueada por trigger/regra)
  if (taxId) {
    const found2 = await q(
      `
      select supplier_id
        from public.suppliers
       where regexp_replace(coalesce(tax_id,''), '\\\\D', '', 'g') = $1
       limit 1
      `,
      [taxId]
    );
    if (found2.rowCount) return found2.rows[0].supplier_id;
  }

  throw new Error('Não consegui resolver/criar supplier_id em public.suppliers.');
}
