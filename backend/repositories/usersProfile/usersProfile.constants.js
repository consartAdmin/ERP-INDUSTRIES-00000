// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.constants.js — Tabela e permissões                    ║
// ║ Tabela: public."usersProfile"                                      ║
// ║ Os perfis ficam em public."accessProfiles" (cadastro de perfis).   ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  PERMISSION_KEYS,
  NO_ACCESS_CODE as DEFAULT_PROFILE,
  CUSTOM_CODE as CUSTOM_PROFILE,
} from '../accessProfiles/accessProfiles.constants.js';

export const TB = 'public."usersProfile"';
export const ALIAS = 'up';
