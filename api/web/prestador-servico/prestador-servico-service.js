
const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const passwordGenerator = require('generate-password');

const Dao = require('./prestador-servico-dao');
const dao = new Dao();

exports.buscar = buscar;
exports.tabela = tabela;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;
exports.combo = combo;
exports.comboTodos = comboTodos;
exports.buscarDadosAcesso = buscarDadosAcesso;
exports.alterarSenhaAplicativo = alterarSenhaAplicativo;

async function buscar(req, res) {

    if(!req.params.id) {
        return await ctrl.gerarRetornoErro(res);
    }

    const tipoAmbiente = await dao.buscar(req.params.id);
    await ctrl.gerarRetornoOk(res, tipoAmbiente);
    
}

async function tabela(req, res) {

    const params = await utils.getDatatableParams(req);
    const tabela = await dao.datatable(params.filters.razaoSocial, params.length, params.start);
    await ctrl.gerarRetornoDatatable(res, tabela);

}

async function inserir(req, res) {

    const senhaAplicativo = passwordGenerator.generate({
        length: 10,
        numbers: true,
        uppercase: false,
        symbols: false
    });

    await dao.insert(req.body.razaoSocial, req.body.cnpj, req.body.endereco, req.body.numero, req.body.bairro, req.body.cep, req.body.telefone, req.body.email, senhaAplicativo);
    await ctrl.gerarRetornoOk(res);
    
}

async function atualizar(req, res) {

    if(req.params.id != req.body.id) {
        return await ctrl.gerarRetornoErro(res);
    }

    await dao.atualizar(req.params.id, req.body.razaoSocial, req.body.cnpj, req.body.endereco, req.body.numero, req.body.bairro, req.body.cep, req.body.telefone, req.body.email);
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

    switch(req.userData.origem.codigo) {
        case 'sme'  : return await ctrl.gerarRetornoOk(res, await dao.combo());
        case 'dre'  : return await ctrl.gerarRetornoOk(res, await dao.combo());
        case 'ps'   : return await ctrl.gerarRetornoOk(res, [ await dao.buscar(req.userData.idOrigemDetalhe) ]);
        case 'ue'   : return await ctrl.gerarRetornoOk(res, await dao.comboPorUnidadeEscolar(req.userData.idOrigemDetalhe));
        default     : return await ctrl.gerarRetornoOk(res, []);
    }

}

async function comboTodos(req, res) {

    switch(req.userData.origem.codigo) {
        case 'sme'  : return await ctrl.gerarRetornoOk(res, await dao.comboTodos());
        case 'dre'  : return await ctrl.gerarRetornoOk(res, await dao.comboTodos());
        case 'ps'   : return await ctrl.gerarRetornoOk(res, [ await dao.buscar(req.userData.idOrigemDetalhe) ]);
        case 'ue'   : return await ctrl.gerarRetornoOk(res, await dao.comboPorUnidadeEscolar(req.userData.idOrigemDetalhe));
        default     : return await ctrl.gerarRetornoOk(res, []);
    }

}

async function buscarDadosAcesso(req, res) {

    if(req.userData.origem.codigo != 'ps') {
        return res.status(401).json({
            status: false, 
            msg: 'Acesso não autorizado.'
        });
    }

    const dadosAcesso = await dao.buscarDadosAcesso(req.userData.idOrigemDetalhe);
    return await ctrl.gerarRetornoOk(res, dadosAcesso);

}

async function alterarSenhaAplicativo(req, res) {

    if(req.userData.origem.codigo != 'ps') {
        return res.status(401).json({
            status: false, 
            msg: 'Acesso não autorizado.'
        });
    }

    if(!req.body.senhaAplicativo) {
        return await ctrl.gerarRetornoErro(res, );
    }

    await dao.alterarSenhaAplicativo(req.userData.idOrigemDetalhe, req.body.senhaAplicativo);
    return await ctrl.gerarRetornoOk(res);

}