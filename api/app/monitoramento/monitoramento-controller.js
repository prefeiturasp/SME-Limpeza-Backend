const router = require('express').Router();
const service = require('./monitoramento-service');

router.route('/turno').get(service.buscarTurnos);
router.route('/turno/:idTurno/ambiente-geral').get(service.buscarAmbienteGeralTurno);
router.route('/turno/:idTurno/ambiente-geral/:idAmbienteGeral').get(service.buscarMonitoramentos);

router.route('/buscar-todos').get(service.buscarTodos);
router.route('/atualizar-todos').post(service.atualizarTodos);

router.route('/atualizar/:id').post(service.atualizar);

module.exports = router;