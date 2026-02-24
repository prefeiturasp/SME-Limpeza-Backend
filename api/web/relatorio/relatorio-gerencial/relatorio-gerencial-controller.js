
const router = require('express').Router();
const service = require('./relatorio-gerencial-service');

router.route('/tabela').get(service.tabela);
router.route('/:id').get(service.buscar);
router.route('/avaliar/:id').post(service.avaliar);
router.route('/consolidar/:id').post(service.consolidar);
router.route('/desconsolidar/:id').post(service.desconsolidar);
router.route('/aprovar/:id').post(service.aprovar);
router.route('/reverter-aprovacao/:id').post(service.reverterAprovacao);
router.route('/valor-bruto/:id').patch(service.atualizarValorBruto);
router.route('/:id').delete(service.remover);
router.route('/').post(service.inserir);

module.exports = router;