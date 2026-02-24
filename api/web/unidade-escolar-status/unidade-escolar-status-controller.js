
const router = require('express').Router();
const service = require('./unidade-escolar-status-service');

router.route('/combo').get(service.combo);
router.route('/historicoStatusUE').post(service.historicoStatusUE);
router.route('/salvaHistoricoStatusUE').post(service.salvaHistoricoStatusUE);

module.exports = router;