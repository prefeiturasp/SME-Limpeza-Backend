const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./ocorrencia-mensagem-dao');
const UsuarioDao = require('../../usuario/usuario/usuario-dao');

const dao = new Dao();
const usuarioDao = new UsuarioDao();

exports.tabela = tabela;
exports.buscarPorOcorrencia = buscarPorOcorrencia;
exports.buscarUltimos = buscarUltimos;
exports.inserir = inserir;

async function buscarPorOcorrencia(req, res) {
    const mensagemList = await dao.buscarPorOcorrencia(req.params.idOcorrencia);
    await ctrl.gerarRetornoOk(res, mensagemList || []);
}

async function buscarUltimos(req, res) {
    const ehPrestadorServico = req.userData.origem.codigo === 'ps';
    const idPrestadorServico = ehPrestadorServico ? req.userData.idOrigemDetalhe : null;
    const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : null;
    const idContratoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
    const dados = await dao.buscarUltimos(req.userData.idUsuario, ehPrestadorServico, idPrestadorServico, idUnidadeEscolar, idContratoList);
    await ctrl.gerarRetornoOk(res, dados);
}

async function tabela(req, res) {
    const params = await utils.getDatatableParams(req);
    const ehPrestadorServico = req.userData.origem.codigo === 'ps';
    const idPrestadorServico = ehPrestadorServico ? req.userData.idOrigemDetalhe : null;
    const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : null;
    const idContratoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
    const tabela = await dao.datatable(req.userData.idUsuario, ehPrestadorServico, idPrestadorServico, idUnidadeEscolar, idContratoList, params.length, params.start);
    await ctrl.gerarRetornoDatatable(res, tabela);
}

async function inserir(req, res) {

    const { idOcorrencia, mensagem } = req.body;
    const idUsuario = req.userData.idUsuario;
    const dataHora = new Date();

    await dao.inserir(parseInt(idOcorrencia), idUsuario, mensagem, dataHora);
    await ctrl.gerarRetornoOk(res);

}