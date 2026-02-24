const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./plano-trabalho-matriz-dao');
const dao = new Dao();

exports.buscar = buscar;
exports.buscarPorAmbienteGeralPeriodicidadeTurno = buscarPorAmbienteGeralPeriodicidadeTurno;
exports.tabela = tabela;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;
exports.comboUnidadeEscolar = comboUnidadeEscolar;

async function buscar(req, res) {

    if(!req.params.id) {
        return await ctrl.gerarRetornoErro(res);
    }

    try {
        const response = await dao.findById(req.params.id);
        await ctrl.gerarRetornoOk(res, response);
    } catch(error) {
        console.log(error);
        await ctrl.gerarRetornoErro(res);
    }

}

async function buscarPorAmbienteGeralPeriodicidadeTurno(req, res) {

    const { idAmbienteGeral, idPeriodicidade, idTurno } = req.params;

    if(!idAmbienteGeral || !idPeriodicidade || !idTurno) {
        return await ctrl.gerarRetornoErro(res);
    }

    try {
        const response = await dao.buscarPorAmbienteGeralPeriodicidadeTurno(idAmbienteGeral, idPeriodicidade, idTurno);
        await ctrl.gerarRetornoOk(res, response);
    } catch(error) {
        console.log(error);
        await ctrl.gerarRetornoErro(res);
    }

}

async function tabela(req, res) {

    const params = await utils.getDatatableParams(req);
    const tabela = await dao.datatable(params.filters.idPeriodicidade, params.filters.idAmbienteGeral, params.filters.idTipoAmbiente, params.length, params.start);
    await ctrl.gerarRetornoDatatable(res, tabela);

}

async function inserir(req, res) {

    const { idAmbienteGeral, idPeriodicidade, turnoList, descricao } = req.body;
    const _transaction = await ctrl.iniciarTransaction();

    try {

        for(let turno of turnoList) {
            await dao.insert(_transaction, descricao, idPeriodicidade, idAmbienteGeral, turno.id);
        }

        await ctrl.finalizarTransaction(true, _transaction);
        await ctrl.gerarRetornoOk(res);

    } catch(error) {
        console.log(error);
        await ctrl.finalizarTransaction(false, _transaction);
        await ctrl.gerarRetornoErro(res);
    }

}

async function atualizar(req, res) {

    if(req.params.id != req.body.id) {
        await ctrl.gerarRetornoErro(res);
    }

    try {
        await dao.atualizar(req.params.id, req.body.descricao, req.body.idPeriodicidade, req.body.idAmbienteGeral, req.body.idTurno);
        await ctrl.gerarRetornoOk(res);
    } catch(error) {
        console.log(error);
        await ctrl.gerarRetornoErro(res);
    }

}

async function remover(req, res) {

    if(!req.params.id) {
        await ctrl.gerarRetornoErro(res);
    }

    try {
        await dao.remover(req.params.id);
        await ctrl.gerarRetornoOk(res);
    } catch(error) {
        console.log(error);
        await ctrl.gerarRetornoErro(res);
    }

}

async function comboUnidadeEscolar(req, res) {

    if(req.userData.origem.codigo != 'ue') {
        await ctrl.gerarRetornoErro(res);
    }
    
    try {
        const combo = await dao.comboUnidadeEscolar(req.userData.idOrigemDetalhe);
        await ctrl.gerarRetornoOk(res, combo);
    } catch(error) {
        console.log(error);
        await ctrl.gerarRetornoErro(res);
    }

}