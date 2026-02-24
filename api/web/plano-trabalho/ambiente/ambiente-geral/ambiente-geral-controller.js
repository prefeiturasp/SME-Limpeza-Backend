
const router = require('express').Router();
const service = require('./ambiente-geral-service');

router.route('/tabela').get(service.tabela);
router.route('/combo').get(service.combo);
router.route('/:id').get(service.buscar);
router.route('/').post(service.inserir);
router.route('/:id').patch(service.atualizar);
router.route('/:id').delete(service.remover);

module.exports = router;