const router  = require('express').Router();
const service = require('./auth-service');

router.route('/').post(service.authenticate);
router.route('/recuperar-senha/:token').get(service.buscarTokenRecuperacao);
router.route('/recuperar-senha').post(service.enviarEmailRecuperacao);
router.route('/recuperar-senha/:id').patch(service.atualizarSenha);

module.exports = router;