const router = require('express').Router();
const service = require('./contrato-status-service');

router.route('/comboStaContrato').get(service.comboStaContrato);
router.route('/atualizarStatusContrato').post(service.atualizarStatusContrato);

module.exports = router;