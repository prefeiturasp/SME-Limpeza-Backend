const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./ambiente-geral-dao');
const dao = new Dao();

exports.buscar = buscar;
exports.tabela = tabela;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;
exports.combo = combo;

async function buscar(req, res) {

    if(!req.params.id) {
        return await ctrl.gerarRetornoErro(res);
    }

    const ambiente = await dao.findById(req.params.id);
    await ctrl.gerarRetornoOk(res, ambiente);

}

async function tabela(req, res) {

    const params = await utils.getDatatableParams(req);
    const tabela = await dao.datatable(params.filters.descricao, params.filters.idTipoAmbiente, params.length, params.start);
    await ctrl.gerarRetornoDatatable(res, tabela);
    
}

async function inserir(req, res) {

    await dao.insert(req.body.descricao, req.body.idTipoAmbiente);
    await ctrl.gerarRetornoOk(res);
    
}

async function atualizar(req, res) {

    if(req.params.id != req.body.id) {
        return await ctrl.gerarRetornoErro(res);
    }

    await dao.atualizar(req.params.id, req.body.descricao, req.body.idTipoAmbiente);
    await ctrl.gerarRetornoOk(res);

}

async function remover(req, res) {

    if(!req.params.id) {
        return await ctrl.gerarRetornoErro(res);
    }

    await dao.remover(req.params.id);
    await ctrl.gerarRetornoOk(res);

}

async function combo(req, res) {

    try {
        const combo = await dao.combo();
        await ctrl.gerarRetornoOk(res, combo);
    } catch(error) {
        console.log(error);
        await ctrl.gerarRetornoErro(res);
    }

}