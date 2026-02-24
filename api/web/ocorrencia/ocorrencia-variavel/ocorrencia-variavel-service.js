const moment = require('moment');

const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./ocorrencia-variavel-dao');
const UnidadeEscolarDao = require('../../unidade-escolar/unidade-escolar-dao');

const dao = new Dao();
const unidadeEscolarDao = new UnidadeEscolarDao();

exports.combo = combo;

async function combo(req, res) {

  const { flagApenasMonitoramento, data } = req.query;
  const idUnidadeEscolar = req.userData.idOrigemDetalhe;

  if (!data) {
    return await ctrl.gerarRetornoErro(res, 'Requisição sem a informação da data da ocorrência.');
  }

  try {

    const unidadeEscolar = await unidadeEscolarDao.findById(idUnidadeEscolar);
    const contrato = await unidadeEscolarDao.buscarContrato(unidadeEscolar.idUnidadeEscolar, moment(data).format('YYYY-MM-DD'));

    if (!contrato) {
      return await ctrl.gerarRetornoErro(res, 'Unidade Escolar não possui contrato ativo para a data.');
    }

    const combo = await dao.combo(flagApenasMonitoramento, contrato.modelo);
    await ctrl.gerarRetornoOk(res, combo || []);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }


}