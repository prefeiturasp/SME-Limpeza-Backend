
const router = require('express').Router();
const service = require('./ocorrencia-situacao-service');

router.route('/combo/').get(service.combo);

module.exports = router;