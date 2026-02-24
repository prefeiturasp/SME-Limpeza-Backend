
const router = require('express').Router();
const service = require('./ocorrencia-variavel-service');

router.route('/combo-cadastro/').get(service.combo);

module.exports = router;