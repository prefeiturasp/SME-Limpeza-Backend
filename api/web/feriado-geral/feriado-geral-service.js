const rfr = require('rfr');
const ctrl = rfr('core/controller.js');
const utils = rfr('core/utils/utils.js');

const Dao = require('./feriado-geral-dao');
const dao = new Dao();

exports.tabela = tabela;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;

async function tabela(req, res) {

    const params = await utils.getDatatableParams(req);
    const tabela = await dao.datatable(params.length, params.start);
    await ctrl.gerarRetornoDatatable(res, tabela);

}

async function inserir(req, res) {

    const { data, descricao, recorrente } = req.body;

    try {
        await dao.insert(data, descricao, recorrente);
        await ctrl.gerarRetornoOk(res);
    } catch(error) {
        console.log(error);
        return await ctrl.gerarRetornoErro(res);
    }
    
}

async function atualizar(req, res) {

    const { id, data, descricao, recorrente } = req.body;

    if(req.params.id != id) {
        return await ctrl.gerarRetornoErro(res);
    }

    try {
        await dao.atualizar(id, data, descricao, recorrente);
        await ctrl.gerarRetornoOk(res);
    } catch(error) {
        console.log(error);
        return await ctrl.gerarRetornoErro(res);
    }

}

async function remover(req, res) {

    const idFeriado = req.params.id;

    if(!idFeriado) {
        return await ctrl.gerarRetornoErro(res);
    }

    await dao.remover(idFeriado);
    await ctrl.gerarRetornoOk(res);

}