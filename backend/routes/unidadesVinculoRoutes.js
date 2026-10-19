// unidadesVinculoRoutes.js
import { Router } from 'express';
import vincCtrl from '../controllers/unidadesVinculoController.js';

const router = Router();

/*
  Em app.js:
    app.use('/api/produtos', router);

  Endpoints:
    GET    /api/produtos/:produto_id/unidades/vinculos
    POST   /api/produtos/:produto_id/unidades
    PUT    /api/produtos/:produto_id/unidades/:unidade_produto_id
    DELETE /api/produtos/:produto_id/unidades/:unidade_produto_id
    PATCH  /api/produtos/:produto_id/unidades/:unidade_produto_id/padrao
*/

router.get('/:produto_id/unidades/vinculos', vincCtrl.listarVinculosEDisponiveis);
router.post('/:produto_id/unidades',          vincCtrl.criarVinculo);
router.put('/:produto_id/unidades/:unidade_produto_id',    vincCtrl.atualizarVinculo);
router.delete('/:produto_id/unidades/:unidade_produto_id', vincCtrl.removerVinculo);
router.patch('/:produto_id/unidades/:unidade_produto_id/padrao', vincCtrl.definirUnidadePadrao);

export default router;

//TESTE: http://localhost:8080/api/produtos/4829/unidades/vinculos //
