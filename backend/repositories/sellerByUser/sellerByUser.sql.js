// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByUser.sql.js — SELECT base com JOIN (users + sellers)       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB, TB_USERS, TB_SELLERS } from './sellerByUser.constants.js';

export const SELECT_JOIN = `
  SELECT
    sbu.id,
    sbu.user_id,
    sbu.seller_id,
    sbu.is_primary,
    sbu.active,
    sbu.created_at,
    sbu.updated_at,

    u.name      AS user_name,
    u.email     AS user_email,
    u.is_active AS user_is_active,

    s.name      AS seller_name,
    s.nickname  AS seller_nickname,
    s.document  AS seller_document,
    s.active    AS seller_active

  FROM ${TB} sbu
  LEFT JOIN ${TB_USERS} u
    ON u.id = sbu.user_id
  LEFT JOIN ${TB_SELLERS} s
    ON s.id = sbu.seller_id
`;
