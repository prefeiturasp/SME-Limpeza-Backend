
const router = require('express').Router();
const service = require('./ocorrencia-retroativa-service');

router.route('/combo/').get(service.combo);
router.route('/tabela').get(service.tabela);
router.route('/comboTodasUesPorIdContrato/').post(service.comboUesPorIdContrato);
router.route('/cadastrarOcorrenciaRetroativa/').post(service.cadastrarOcorrenciaRetroativa);
router.route('/buscaDataOcorrenciaRetroativa/').post(service.buscaDataOcorrenciaRetroativa);
router.route('/buscaDetalhesOcorrenciaRetroativa/').post(service.buscaDetalhesOcorrenciaRetroativa);

module.exports = router;