
const router = require('express').Router();
const service = require('./usuario-origem-service');

router.route('/combo').get(service.combo);
router.route('/combo-dre-ps/:idPrestadorServico').get(service.carregarComboDrePs);

module.exports = router;