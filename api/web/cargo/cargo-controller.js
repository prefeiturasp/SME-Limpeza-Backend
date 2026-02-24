
const router = require('express').Router();
const service = require('./cargo-service');

router.route('/combo').get(service.combo);
router.route('/tabela').get(service.tabela);

router.route('/').post(service.inserir);
router.route('/:id').delete(service.remover);

module.exports = router;