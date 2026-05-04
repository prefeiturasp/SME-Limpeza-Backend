
const router    = require('express').Router();
const service   = require('./monitoramento-service');

router.route('/tabela').get(service.tabela);
router.route('/tabela-datas-agendamento-manual').get(service.tabelaDatasAgendamentoManual);
router.route('/:id').get(service.buscar);
router.route('/').post(service.inserir);
router.route('/:id').patch(service.atualizar);
router.route('/:id').delete(service.remover);
router.route('/comboUePorIdContrato').post(service.comboUePorIdContrato);
router.route('/comboPrestadorServicoPorIdContrato').post(service.comboPrestadorServicoPorIdContrato);
router.route('/comboContratoPorIdPrestadorServico').post(service.comboContratoPorIdPrestadorServico);
router.route('/comboUePorIdPrestadorServico').post(service.comboUePorIdPrestadorServico);
router.route('/comboContratoPorIdUe').post(service.comboContratoPorIdUe);
router.route('/comboPrestadorServicoPorIdUe').post(service.comboPrestadorServicoPorIdUe);
router.route('/verificaSeDataEferiado').post(service.verificaSeDataEferiado);

module.exports = router;
 