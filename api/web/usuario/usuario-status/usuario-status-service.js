const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./usuario-status-dao');
const dao = new Dao();

exports.combo = combo;

async function combo(req, res) {

    const combo = await dao.combo();
    await ctrl.gerarRetornoOk(res, combo || []);

}