const router = require('express').Router();
const service = require('./endereco-service');

router.route('/cep/:cep').get(service.buscarPorCep);
router.route('/coordenadas').post(service.buscarCoordenadas);

module.exports = router;