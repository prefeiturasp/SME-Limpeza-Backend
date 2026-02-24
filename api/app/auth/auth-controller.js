const router = require('express').Router();
const service = require('./auth-service');

router.route('/').post(service.authenticate);

module.exports = router;