// ╔════════════════════════════════════════════════════════════════════╗
// ║ drivers.sql.js — SELECT base de motoristas (JOIN employees)        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB } from './drivers.constants.js';

export const SELECT = `
  SELECT d.driver_id, d.employee_id, d.cnh_number, d.cnh_category, d.cnh_expiration::text AS cnh_expiration,
         COALESCE(d.phone, e.mobile, e.phone) AS phone, d.phone AS driver_phone,
         d.is_active, d.notes, d.created_at, d.updated_at,
         e.full_name, e.cpf, e.position, e.active AS employee_active,
         (d.cnh_expiration IS NOT NULL AND d.cnh_expiration < CURRENT_DATE) AS cnh_expired
    FROM ${TB} d
    JOIN public.employees e ON e.employee_id = d.employee_id
`;
