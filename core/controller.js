const UsuarioCargoConstants = require('./constants/usuario-cargo.constantes.js');

const conn = require('../core/database');
const path = require('path'); 
require('dotenv').config({ path: path.join(__dirname, '.env') });

const emailService = require('./email');

exports.iniciarTransaction = conn.iniciarTransaction;
exports.finalizarTransaction = conn.finalizarTransaction;

exports.gerarRetorno = async(res, status, data = null, msg = null) => {
    const httpCode = status ? 200 : 500;
    await res.status(httpCode).send({ status: status, data: data, msg: msg });
    return status;
};

exports.gerarRetornoOk = async(res, data = null, msg = null) => {
    this.gerarRetorno(res, true, data, msg);
    return true;
};

exports.gerarRetornoErro = async (res, msg) => {
    this.gerarRetorno(res, false, null, msg || 'Houve um erro ao realizar a operação.');
    return false;
};

exports.gerarRetornoDatatable = async (res, tabela) => {
    return res.status(200).send({'datatables': {
        recordsFiltered: tabela.length,
        recordsTotal:  tabela[0] ? parseInt(tabela[0].recordsTotal) : 0,
        data: tabela
    }});
};

exports.enviarEmail = async (destinatario, assunto, conteudo) => {
    return await emailService.enviar(destinatario, assunto, conteudo);
};

exports.verificarPodeFiscalizar = async (userData, idUnidadeEscolar) => {

    const ehCargoFiscal = [
        UsuarioCargoConstants.FISCAL_TITULAR, 
        UsuarioCargoConstants.FISCAL_SUPLENTE
    ].includes(parseInt(userData.cargo.id));

    return ehCargoFiscal && idUnidadeEscolar == userData.idOrigemDetalhe;

}