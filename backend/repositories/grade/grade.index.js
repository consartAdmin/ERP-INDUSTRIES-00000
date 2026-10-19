// ╔════════════════════════════════════════════════════════════════════╗
// ║ grade.index.js — ponto de entrada do módulo Grade/Variações        ║
// ║ Mantém a mesma API pública do antigo gradeApi.js (cliente HTTP)    ║
// ╚════════════════════════════════════════════════════════════════════╝

export { getProdutoById, listarGrades } from './gradeProduto.repository.js';
export {
  listarGrade,
  salvarGrade,
  removerVariacao,
  listarVinculosPorSku,
  syncVinculosPorSku,
  criarVinculo,
  atualizarVinculo,
  removerVinculo,
} from './gradeVinculos.repository.js';
