const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./cargo-dao');
const dao = new Dao();

exports.tabela = async (req, res) => {

  if (req.userData.origem.codigo !== 'sme') {
    return ctrl.gerarRetornoErro(res);
  }

  const params = await utils.getDatatableParams(req);
  const tabela = await dao.datatable(params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);

}

exports.inserir = async (req, res) => {

  if (req.userData.origem.codigo !== 'sme') {
    return ctrl.gerarRetornoErro(res);
  }

  const descricao = req.body.descricao;
  const existente = await dao.buscarPorDescricaoAndAtivo(descricao);

  if (existente) {
    return await ctrl.gerarRetornoErro(res, 'Já existe um cargo cadastrado para a descrição informada.');
  }

  await dao.insert(descricao);
  await ctrl.gerarRetornoOk(res);

}

exports.remover = async (req, res) => {

  if (req.userData.origem.codigo !== 'sme') {
    return ctrl.gerarRetornoErro(res);
  }

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const existentes = await dao.buscarVinculoContrato(req.params.id);

  if (existentes.length > 0) {
    return await ctrl.gerarRetornoErro(res, 'Não é possível excluir o cargo, pois ele está vinculado a um ou mais contratos ativos.');
  }


  await dao.remover(req.params.id);
  await ctrl.gerarRetornoOk(res);

}

exports.combo = async (req, res) => {
  switch (req.userData.origem.codigo) {
    case 'sme': return await ctrl.gerarRetornoOk(res, await dao.combo(req.userData.idOrigemDetalhe));
    case 'dre': return await ctrl.gerarRetornoOk(res, [await dao.buscar(req.userData.idOrigemDetalhe)]);
    default: return await ctrl.gerarRetornoOk(res, []);
  }
}