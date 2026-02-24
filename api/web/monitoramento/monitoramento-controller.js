
const router    = require('express').Router();
const service   = require('./monitoramento-service');

router.route('/tabela').get(service.tabela);
router.route('/tabela-datas-agendamento-manual').get(service.tabelaDatasAgendamentoManual);
router.route('/:id').get(service.buscar);
router.route('/').post(service.inserir);
router.route('/:id').patch(service.atualizar);
router.route('/:id').delete(service.remover);

module.exports = router;
 