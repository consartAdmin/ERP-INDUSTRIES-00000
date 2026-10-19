// ╔════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.constants.js — Tabela e perfis iniciais             ║
// ║ Tabela: public."accessProfiles"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public."accessProfiles"';
export const ALIAS = 'ap';

/** Ações controladas por módulo (colunas booleanas) */
export const PERMISSION_KEYS = Object.freeze([
  'can_view',
  'can_create',
  'can_edit',
  'can_delete',
  'can_export',
]);

/** Perfil usado quando o usuário não tem registro para o módulo */
export const NO_ACCESS_CODE = 'SEM_ACESSO';

/** Perfil cujas permissões são marcadas por módulo na tela de usuários */
export const CUSTOM_CODE = 'PERSONALIZADO';

/** Tamanho máximo do código (coluna usersProfile.profile é VARCHAR(30)) */
export const CODE_MAX_LENGTH = 30;

/**
 * Perfis criados automaticamente na primeira subida.
 * SEM_ACESSO e PERSONALIZADO são do sistema e não podem ser excluídos.
 */
export const SEED_PROFILES = Object.freeze([
  {
    code: NO_ACCESS_CODE, name: 'Sem acesso', description: 'Não visualiza o módulo.',
    is_system: true, is_custom: false, sort_order: 0,
    can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false,
  },
  {
    code: 'CONSULTA', name: 'Consulta', description: 'Apenas visualiza os registros.',
    is_system: false, is_custom: false, sort_order: 10,
    can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false,
  },
  {
    code: 'OPERADOR', name: 'Operador', description: 'Visualiza, inclui e edita registros.',
    is_system: false, is_custom: false, sort_order: 20,
    can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: false,
  },
  {
    code: 'GERENTE', name: 'Gerente', description: 'Visualiza, inclui, edita e exporta registros.',
    is_system: false, is_custom: false, sort_order: 30,
    can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: true,
  },
  {
    code: 'ADMINISTRADOR', name: 'Administrador', description: 'Acesso total ao módulo, inclusive exclusão.',
    is_system: false, is_custom: false, sort_order: 40,
    can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true,
  },
  {
    code: CUSTOM_CODE, name: 'Personalizado', description: 'Permissões marcadas manualmente em cada módulo.',
    is_system: true, is_custom: true, sort_order: 999,
    can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false,
  },
]);
