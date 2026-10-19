```SQL

export async function consumeLot({ lot_id, qty }) {
  const q = Number(qty);

  if (!lot_id) throw new Error('lot_id is required');
  if (!(q > 0)) throw new Error('qty must be > 0');

  await assertCanMoveLotByLotId(lot_id, pool);

  const res = await pool.query(
    `
    UPDATE ${TB_LOTS}
       SET qty_reserved = GREATEST(0, qty_reserved - $2),
           qty_on_hand = qty_on_hand - $2
     WHERE lot_id = $1
       AND qty_on_hand >= $2
    RETURNING *, (qty_on_hand - qty_reserved) AS qty_available
    `,
    [lot_id, q]
  );

  if (!res.rowCount) {
    throw new Error('Insufficient qty_on_hand to consume from this lot');
  }

  return res.rows[0];
}

```