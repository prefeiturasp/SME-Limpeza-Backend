
const router = require('express').Router();
const service = require('./prestador-servico-service');

router.route('/tabela').get(service.tabela);
router.route('/combo').get(service.combo);
router.route('/combo-todos').get(service.comboTodos);
router.route('/buscar-dados-acesso').get(service.buscarDadosAcesso);
router.route('/:id').get(service.buscar);
router.route('/:id').patch(service.atualizar);
router.route('/:id').delete(service.remover);
router.route('/alterar-senha-aplicativo').post(service.alterarSenhaAplicativo);
router.route('/').post(service.inserir);

module.exports = router;