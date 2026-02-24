
const router = require('express').Router();
const service = require('./relatorio-contrato-pontos-service');

router.route('/tabela').get(service.tabela);
router.route('/exportar/:idContrato').get(service.exportar);
router.route('/:idContrato').get(service.buscar);
router.route('/anos/:idContrato').get(service.anos);

module.exports = router;