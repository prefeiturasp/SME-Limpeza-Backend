
const router = require('express').Router();
const service = require('./usuario-status-service');

router.route('/combo').get(service.combo);

module.exports = router;