
const router = require('express').Router();
const service = require('./relatorio-ocorrencia-funcionario-service');

router.route('/tabela').get(service.tabela);

module.exports = router;