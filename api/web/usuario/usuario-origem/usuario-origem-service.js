const ctrl = require('rfr')('core/controller.js');

const Dao = require('./usuario-origem-dao');
const dao = new Dao();

exports.combo = combo;

async function combo(req, res) {
    const combo = await dao.combo(req.userData.cargo.id);
    await ctrl.gerarRetornoOk(res, combo || []);
}