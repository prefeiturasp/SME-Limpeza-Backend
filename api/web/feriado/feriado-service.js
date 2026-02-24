const rfr = require('rfr');
const ctrl = rfr('core/controller.js');
const utils = rfr('core/utils/utils.js');

const Dao = require('./feriado-dao');
const dao = new Dao();

exports.tabela = tabela;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;

async function tabela(req, res) {

    const idUnidadeEscolar = req.userData.idOrigemDetalhe;
    const params = await utils.getDatatableParams(req);
    const tabela = await dao.datatable(idUnidadeEscolar, params.length, params.start);
    await ctrl.gerarRetornoDatatable(res, tabela);

}

async function inserir(req, res) {

    const idUnidadeEscolar = req.userData.idOrigemDetalhe;
    const { data, descricao } = req.body;

    try {
        await dao.insert(idUnidadeEscolar, data, descricao);
        await ctrl.gerarRetornoOk(res);
    } catch(error) {
        console.log(error);
        return await ctrl.gerarRetornoErro(res);
    }
    
}

async function atualizar(req, res) {

    const idUnidadeEscolar = req.userData.idOrigemDetalhe;
    const { id, data, descricao } = req.body;

    if(req.params.id != id) {
        return await ctrl.gerarRetornoErro(res);
    }

    try {
        await dao.atualizar(id, descricao);
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