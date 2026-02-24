const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./usuario-cargo-dao');
const dao = new Dao();

exports.combo = combo;

async function combo(req, res) {

    if(!req.params.idUsuarioOrigem) {
        return await ctrl.gerarRetornoErro(res);
    }

    const combo = await dao.combo(req.params.idUsuarioOrigem);
    await ctrl.gerarRetornoOk(res, combo || []);

}