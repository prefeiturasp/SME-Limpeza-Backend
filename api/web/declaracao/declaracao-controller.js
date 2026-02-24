
const router = require('express').Router();
const service = require('./declaracao-service');

router.route('/tabela').get(service.tabela);
router.route('/').post(service.inserir);

module.exports = router;