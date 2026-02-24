const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./turno-dao');
const dao = new Dao();

exports.combo = combo;

async function combo(req, res) {

    try {
        const combo = await dao.combo();
        await ctrl.gerarRetornoOk(res, combo);
    } catch(error) {
        console.log(error);
        await ctrl.gerarRetornoErro(res);
    }

}