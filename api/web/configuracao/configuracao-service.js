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