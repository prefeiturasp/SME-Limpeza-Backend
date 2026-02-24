const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const moment = require('moment');

const Dao = require('./relatorio-ocorrencia-funcionario-dao');
const dao = new Dao();

exports.tabela = tabela;

async function tabela(req, res) {
  const params = await utils.getDatatableParams(req);
  const idUnidadeEscolar = params.filters.unidadeEscolar?.id;
  const dataInicial = moment(params.filters.dataInicial).format('YYYY-MM-DD');
  const dataFinal = moment(params.filters.dataFinal).format('YYYY-MM-DD');
  const tabela = await dao.datatable(idUnidadeEscolar, dataInicial, dataFinal, params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);
}