
const router = require('express').Router();
const service = require('./plano-trabalho-matriz-service');

router.route('/tabela').get(service.tabela);
router.route('/combo-unidade-escolar').get(service.comboUnidadeEscolar);
router.route('/ambiente-geral/:idAmbienteGeral/periodicidade/:idPeriodicidade/turno/:idTurno').get(service.buscarPorAmbienteGeralPeriodicidadeTurno);
router.route('/:id').get(service.buscar);
router.route('/').post(service.inserir);
router.route('/:id').patch(service.atualizar);
router.route('/:id').delete(service.remover);

module.exports = router;