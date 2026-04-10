const router = require('express').Router();
const service = require('./configuracao-service');

// Rota para buscar todas as configurações de e-mail
router.route('/email-settings').get(service.buscarEmailSettings);
// Rota para atualizar as configurações de e-mail
router.route('/email-settings').patch(service.atualizarEmailSettings);

router.route('/manutencao-sistema/').post(service.salvaManutencaoSistema);
router.route('/:parametro').get(service.buscar);
router.route('/').get(service.buscar);
router.route('/:parametro').patch(service.atualizar);

module.exports = router;