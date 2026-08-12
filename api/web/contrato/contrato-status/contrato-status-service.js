const ctrl = require('rfr')('core/controller.js');

const Dao = require('./contrato-status-dao');
const dao = new Dao();

exports.comboStaContrato = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.comboStaContrato(req.userData.idOrigemDetalhe));
};

exports.atualizarStatusContrato = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.atualizarStatusContrato(req.body.idContrato, req.body.idStatusContrato, req.body.motivoStatusContrato));
};