
const router = require('express').Router();
const service = require('./contrato-status-service');

router.route('/comboStaContrato').get(service.comboStaContrato);
router.route('/atualizarStatusContrato').post(service.atualizarStatusContrato);
router.route('/historicoStatusContrato').post(service.historicoStatusContrato);
router.route('/buscarIdUsuPorEmail').post(service.buscarIdUsuPorEmail);
router.route('/salvaHistoricoStatusContrato').post(service.salvaHistoricoStatusContrato);

module.exports = router;