
const router = require('express').Router();
const service = require('./ocorrencia-tipo-service');


router.route('/combo/').get(service.combo);
router.route('/combo-cadastro/').get(service.comboCadastro);
router.route('/:id').get(service.buscar);
// router.route('/:id').delete(service.remover);
// router.route('/').post(service.inserir);

module.exports = router;