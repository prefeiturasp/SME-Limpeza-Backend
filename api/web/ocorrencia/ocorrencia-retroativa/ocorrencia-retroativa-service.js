const moment = require('moment');

const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./ocorrencia-retroativa-dao');
const UnidadeEscolarDao = require('../../unidade-escolar/unidade-escolar-dao');

const dao = new Dao();
const unidadeEscolarDao = new UnidadeEscolarDao();

exports.combo = combo;;

async function combo(req, res) {

}

exports.comboUesPorIdContrato = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.comboTodasUesPorIdContrato(req.body.idContratoList));
}

exports.cadastrarOcorrenciaRetroativa = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.cadastrarOcorrenciaRetroativa(req.body, req.userData.idUsuario));
}

exports.tabela = async (req, res) => {
  const params = await utils.getDatatableParams(req);
  const dataInicial = params.filters.dataInicial ? moment(params.filters.dataInicial).format('YYYY-MM-DD') : null;
  const dataFinal = params.filters.dataFinal ? moment(params.filters.dataFinal).format('YYYY-MM-DD') : null;
  const idContrato = params.filters.idContrato ? params.filters.idContrato.id : null;
  const idUnidadeEscolar = params.filters.idUnidadeEscolar ? params.filters.idUnidadeEscolar.id : null;
  const tabela = await dao.datatable(params, dataInicial, dataFinal, idContrato, idUnidadeEscolar);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

exports.buscaDataOcorrenciaRetroativa = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.buscaDataOcorrenciaRetroativa(req.body.idUnidadeEscolar));
}

exports.buscaDetalhesOcorrenciaRetroativa = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.buscaDetalhesOcorrenciaRetroativa(req.body.idOcorrenciaRetroativa));
}