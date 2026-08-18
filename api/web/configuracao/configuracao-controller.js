
const router = require('express').Router();
const service = require('./configuracao-service');
// Rota para buscar todas as configurações de e-mail
router.route('/email-settings').get(service.buscarEmailSettings);
// Rota para atualizar as configurações de e-mail
router.route('/email-settings').patch(service.atualizarEmailSettings);
//Rota para buscar lista de emails/lista-emails-para-notificacoes
router.route('/lista-emails-para-notificacoes').get(service.buscaListaEmailsParaNotificacoes);
//Rota para salvar emails de notificações
router.route('/emails-para-notificacoes').post(service.salvarEmailsParaNotificacoes);
// Rota para buscar lista de e-mails PS
router.route('/lista-emails-para-notificacoes-ps').get(service.buscaListaEmailsParaNotificacoesPs);
// Rota para salvar e-mails PS
router.route('/emails-para-notificacoes-ps').post(service.salvarEmailsParaNotificacoesPs);

router.route('/manutencao-sistema/').post(service.salvaManutencaoSistema);
router.route('/:parametro').get(service.buscar);
router.route('/').get(service.buscar);
router.route('/:parametro').patch(service.atualizar);

module.exports = router;