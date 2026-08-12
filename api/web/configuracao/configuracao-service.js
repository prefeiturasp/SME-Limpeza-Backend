const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./configuracao-dao');
const dao = new Dao();


exports.buscar = async (req, res) => {
  const configuracao = req.params.parametro ? await dao.buscar(req.params.parametro) : await dao.buscarTodos();
  await ctrl.gerarRetornoOk(res, configuracao);
}

exports.atualizar = async (req, res) => {

  if (req.userData.origem.codigo !== 'sme') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  if (req.params.parametro !== req.body.parametro) {
    return await ctrl.gerarRetornoErro(res, 'Houve um erro ao validar a requisição.');
  }

  if (req.body.parametro === 'TEXTO_NOTICIA') {
    await dao.atualizarDescricao(req.body.parametro, req.body.descricao);
    return await ctrl.gerarRetornoOk(res);
  }

  if (req.body.novoValor < 0) {
    return await ctrl.gerarRetornoErro(res, 'O valor não pode ser menor que zero.');
  }

  await dao.atualizarValor(req.body.parametro, req.body.novoValor);
  return await ctrl.gerarRetornoOk(res);

}

exports.buscaManutencaoSistema = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.buscaManutencaoSistema());
}

exports.salvaManutencaoSistema = async (req, res) => {
  if (req.userData.origem.codigo !== 'sme') {
    return await ctrl.gerarRetornoErro(res);
  }
  let retorno = await dao.salvaManutencaoSistema(req.body.manutencao);
  return await ctrl.gerarRetornoOk(res, retorno);
}

exports.buscarEmailSettings = async (req, res) => {
  try {
    const settings = await dao.buscarParametrosEmail();
    await ctrl.gerarRetornoOk(res, settings);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }
};

exports.atualizarEmailSettings = async (req, res) => {

  if (req.userData.origem.codigo !== 'sme') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const settingsList = req.body; // Espera um array de { parametro: '...', valor: '...' }

  if (!Array.isArray(settingsList)) {
    return await ctrl.gerarRetornoErro(res, 'Formato de dados inválido. Esperado um array de configurações.');
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {
    for (const setting of settingsList) {
      if (setting.parametro && (setting.valor === '0' || setting.valor === '1')) {
        await dao.atualizarParametro(setting.parametro, setting.valor, _transaction);
      } else {
        console.warn(`Configuração inválida ignorada: ${JSON.stringify(setting)}`);
      }
    }
    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res, null, 'Configurações de e-mail atualizadas com sucesso.');
  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, 'Houve um erro ao atualizar as configurações de e-mail.');
  }
};

exports.buscaListaEmailsParaNotificacoes = async (req, res) => {
  const lista = await dao.buscarListaEmailsParaNotificacoes();
  return await ctrl.gerarRetornoOk(res, lista);
}

exports.salvarEmailsParaNotificacoes = async (req, res) => {
  const emails = req.body.emails;
  if(!emails){
    return await ctrl.gerarRetornoErro(res, 'Não houve emails para salvar');
  }
  await dao.salvarEmailsParaNotificacoes(emails);
  return await ctrl.gerarRetornoOk(res, null, 'Lista de e-mails atualizada com sucesso.');
}

module.exports = exports;

