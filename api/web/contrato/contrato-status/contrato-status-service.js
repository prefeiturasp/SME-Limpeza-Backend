const ctrl = require('rfr')('core/controller.js');

const Dao = require('./contrato-status-dao');
const dao = new Dao();

exports.comboStaContrato = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.comboStaContrato(req.userData.idOrigemDetalhe));
};

exports.atualizarStatusContrato = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.atualizarStatusContrato(req.body.idContrato, req.body.idStatusContrato, req.body.motivoStatusContrato)); 
};

exports.historicoStatusContrato = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.historicoStatusContrato(req.body.idContrato));
};

exports.buscarIdUsuPorEmail = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.buscarIdUsuPorEmail(req.body.emailUsu));
}

exports.salvaHistoricoStatusContrato = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.salvaHistoricoStatusContrato(req.body.idContrato, req.body.statusAntigo, req.body.statusNovo, req.body.motivoStatus, req.body.idUsu));
}