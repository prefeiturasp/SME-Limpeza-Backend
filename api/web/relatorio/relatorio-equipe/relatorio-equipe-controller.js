
const router = require('express').Router();
const service = require('./relatorio-equipe-service');

router.route('/tabela').get(service.tabela);
router.route('/exportar').get(service.exportar);

module.exports = router;