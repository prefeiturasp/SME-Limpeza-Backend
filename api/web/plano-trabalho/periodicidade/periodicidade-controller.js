
const router = require('express').Router();
const service = require('./periodicidade-service');

router.route('/combo').get(service.combo);

module.exports = router;