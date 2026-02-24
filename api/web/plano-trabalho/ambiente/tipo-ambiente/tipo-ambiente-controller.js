
const router = require('express').Router();
const service = require('./tipo-ambiente-service');

router.route('/combo').get(service.combo);

module.exports = router;