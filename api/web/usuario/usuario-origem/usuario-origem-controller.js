
const router = require('express').Router();
const service = require('./usuario-origem-service');

router.route('/combo').get(service.combo);

module.exports = router;