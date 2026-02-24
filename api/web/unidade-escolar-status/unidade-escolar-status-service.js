const ctrl = require('rfr')('core/controller.js');

const Dao = require('./unidade-escolar-status-dao');
const dao = new Dao();

exports.combo = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.combo(req.userData.idOrigemDetalhe));
};

exports.historicoStatusUE = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.historicoStatusUE(req.body.idContrato, req.body.idUe));
};

exports.salvaHistoricoStatusUE = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.salvaHistoricoStatusUE(req.body.idContrato, req.body.idUe, req.body.statusAntigo, req.body.statusNovo, req.body.motivoStatus, req.body.idUsu));
}