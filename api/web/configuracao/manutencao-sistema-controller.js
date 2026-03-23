const router = require('express').Router();
const service = require('./configuracao-service');

router.route('/manutencao-sistema/').get(service.buscaManutencaoSistema);

module.exports = router;