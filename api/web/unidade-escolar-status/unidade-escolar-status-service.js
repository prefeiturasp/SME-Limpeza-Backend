const ctrl = require('rfr')('core/controller.js');

const Dao = require('./unidade-escolar-status-dao');
const dao = new Dao();

exports.combo = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.combo(req.userData.idOrigemDetalhe));
};
