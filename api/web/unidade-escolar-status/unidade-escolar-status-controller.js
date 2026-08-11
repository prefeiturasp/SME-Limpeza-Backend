
const router = require('express').Router();
const service = require('./unidade-escolar-status-service');

router.route('/combo').get(service.combo);

module.exports = router;