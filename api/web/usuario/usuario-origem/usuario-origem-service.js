const ctrl = require('rfr')('core/controller.js');

const Dao = require('./usuario-origem-dao');
const dao = new Dao();

exports.combo = combo;
exports.carregarComboDrePs = carregarComboDrePs;

async function combo(req, res) {
    const combo = await dao.combo(req.userData.cargo.id);
    await ctrl.gerarRetornoOk(res, combo || []);
}

async function carregarComboDrePs(req, res) {
    const combo = await dao.carregarComboDrePs(req.params.idPrestadorServico);
    await ctrl.gerarRetornoOk(res, combo || []);

}