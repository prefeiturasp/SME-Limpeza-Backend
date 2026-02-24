const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./ocorrencia-tipo-dao');
const DaoOcorrenciaVariavel = require('../ocorrencia-variavel/ocorrencia-variavel-dao');

const dao = new Dao();
const daoOcorrenciaVariavel = new DaoOcorrenciaVariavel();

exports.buscar = buscar;
exports.combo = combo;
exports.comboCadastro = comboCadastro;
exports.remover = remover;
exports.inserir = inserir;

async function buscar(req, res) {

    if(!req.params.id) {
        return await ctrl.gerarRetornoErro(res);
    }

    const ocorrenciaTipo = await dao.buscar(req.params.id);
    await ctrl.gerarRetornoOk(res, ocorrenciaTipo);
    
}

async function combo(req, res) {
    const combo = await dao.combo(false);
    await ctrl.gerarRetornoOk(res, combo || []);
}

async function comboCadastro(req, res) {
    const combo = await dao.combo(true);
    await ctrl.gerarRetornoOk(res, combo || []);
}

async function remover(req, res) {

    if(req.userData.origem.codigo !== 'sme') {
        return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
    }

    const _transaction = await ctrl.iniciarTransaction();

    try {

        await dao.remover(_transaction, req.params.id);
        await ctrl.finalizarTransaction(true, _transaction);
        await ctrl.gerarRetornoOk(res, 'Variável Gerencial removida com sucesso.');

    } catch(error) {
        console.log(error);
        await ctrl.finalizarTransaction(false, _transaction);
        await ctrl.gerarRetornoErro(res, 'Houve um erro ao remover a Variável Gerencial.');
    }

}

async function inserir(req, res) {

    if(req.userData.origem.codigo != 'sme') {
        return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
    }
    
    const { id, descricao, peso, flagApenasMonitoramento, variaveis } = req.body;

    if(parseInt(peso) <= 0 || parseInt(peso) > 100) {
        return await ctrl.gerarRetornoOk(res, 'O peso deve ser entre 1 e 100.');
    }

    if(variaveis?.length == 0) {
        return await ctrl.gerarRetornoOk(res, 'Nenhuma variável informada.');
    }

    const pesoTotal = (variaveis).reduce((accumulator, ov) => accumulator + parseInt(ov.peso), 0);
    if(pesoTotal != 100) {
        return await ctrl.gerarRetornoOk(res, `A soma dos pesos é ${pesoTotal}, mas deve ser igual a 100.`);
    }

    const _transaction = await ctrl.iniciarTransaction();

    try {

        if(id) {
            await dao.remover(_transaction, id);
        }
        
        const idOcorrenciaTipo = await dao.insert(_transaction, descricao, peso, flagApenasMonitoramento);

        for(const ov of variaveis) {
            await daoOcorrenciaVariavel.insert(
                _transaction, 
                idOcorrenciaTipo, 
                ov.descricao, 
                ov.peso,
                ov.descricaoConforme, 
                ov.descricaoConformeComRessalva, 
                ov.descricaoNaoConforme
            );
        }

        await ctrl.finalizarTransaction(true, _transaction);
        await ctrl.gerarRetornoOk(res, 'Variável Gerencial inserida com sucesso.');

    } catch(error) {
        console.log(error);
        await ctrl.finalizarTransaction(false, _transaction);
        await ctrl.gerarRetornoErro(res, 'Houve um erro ao inserir a Variável Gerencial.');
    }


}