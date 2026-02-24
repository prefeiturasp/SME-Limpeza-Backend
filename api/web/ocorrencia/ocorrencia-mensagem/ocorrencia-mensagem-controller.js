
const router = require('express').Router();
const service = require('./ocorrencia-mensagem-service');

router.route('/tabela').get(service.tabela);
router.route('/buscar-por-ocorrencia/:idOcorrencia').get(service.buscarPorOcorrencia);
router.route('/ultimos').get(service.buscarUltimos);
router.route('/').post(service.inserir);

module.exports = router;