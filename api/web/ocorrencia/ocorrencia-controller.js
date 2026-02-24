
const router = require('express').Router();
const service = require('./ocorrencia-service');

router.route('/tabela').get(service.tabela);
router.route('/reincidencia-por-prestador').get(service.reincidenciaPorPrestador);
router.route('/ultimos').get(service.buscarUltimos);
router.route('/exportar').get(service.exportar);
router.route('/:id').get(service.buscar);
router.route('/:id').delete(service.remover);
router.route('/').post(service.inserir);
router.route('/encerrar/:id').patch(service.encerrar);
router.route('/reabrir/:id').patch(service.reabrir);

module.exports = router;