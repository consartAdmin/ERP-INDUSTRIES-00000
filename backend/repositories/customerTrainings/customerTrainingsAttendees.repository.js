// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainingsAttendees.repository.js — participantes           ║
// ║ Os participantes são regravados a cada salvamento (lista inteira)  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_ATTENDEES } from './customerTrainings.constants.js';

export async function replaceAttendees(client, trainingId, attendees) {
  await client.query(`DELETE FROM ${TB_ATTENDEES} WHERE training_id = $1`, [trainingId]);

  for (const [index, a] of attendees.entries()) {
    await client.query(
      `
      INSERT INTO ${TB_ATTENDEES} (training_id, name, email, phone, attended, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [trainingId, a.name, a.email, a.phone, a.attended, index]
    );
  }
}
