
const ctrl = require('rfr')('core/controller');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./unidade-escolar-dao');
const dao = new Dao();

exports.combo = async (req, res) => {

  const combo = await dao.buscarPorId(req.idUnidadeEscolar);
  await ctrl.gerarRetornoOk(res, combo || []);

}