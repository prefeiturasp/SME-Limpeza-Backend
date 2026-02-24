
const router = require('express').Router();
const service = require('./usuario-cargo-service');

router.route('/combo/:idUsuarioOrigem').get(service.combo);

module.exports = router;