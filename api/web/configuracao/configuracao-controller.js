
const router = require('express').Router();
const service = require('./configuracao-service');

router.route('/:parametro').get(service.buscar);
router.route('/').get(service.buscar);
router.route('/:parametro').patch(service.atualizar);

module.exports = router;