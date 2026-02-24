
const router = require('express').Router();
const service = require('./turno-service');

router.route('/combo').get(service.combo);

module.exports = router;