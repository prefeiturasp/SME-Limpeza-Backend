const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const moment = require('moment');

const UsuarioCargoConstants = require('../../../core/constants/usuario-cargo.constantes');
const Dao = require('./declaracao-dao');
const DaoUsuario = require('../usuario/usuario/usuario-dao');

const dao = new Dao();
const daoUsuario = new DaoUsuario();

exports.tabela = tabela;
exports.inserir = inserir;

async function tabela(req, res) {
    const params = await utils.getDatatableParams(req);
    const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : params.filters.unidadeEscolar?.id;
    const idDiretoriaRegional = req.userData.origem.codigo === 'dre' ? req.userData.idOrigemDetalhe : null;
    const idContratoList = req.userData.origem.codigo !== 'sme' ? null : (await daoUsuario.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
    const dataInicial = moment(params.filters.dataInicial).format('YYYY-MM-DD');
    const dataFinal = moment(params.filters.dataFinal).format('YYYY-MM-DD');
    const tabela = await dao.datatable(dataInicial, dataFinal, idUnidadeEscolar, idContratoList, idDiretoriaRegional, params.length,params.start);
    await ctrl.gerarRetornoDatatable(res, tabela);
}

async function inserir(req, res) {

    const ehCargoFiscal = [
        UsuarioCargoConstants.FISCAL_TITULAR, 
        UsuarioCargoConstants.FISCAL_SUPLENTE
    ].includes(parseInt(req.userData.cargo.id));

    if(req.userData.origem.codigo !== 'ue' || !ehCargoFiscal) {
        return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
    }

    const idUnidadeEscolar = req.userData.idOrigemDetalhe
    const dataHoraCadastro = new Date();
    const data = moment(req.body.data).format('YYYY-MM-DD');
    const declaracoesExistentes = await dao.buscar(data, idUnidadeEscolar);
    
    if(declaracoesExistentes.length > 0) {
        return await ctrl.gerarRetornoErro(res, 'Já existe uma declaração para a data informada.');
    }

    await dao.insert(data, dataHoraCadastro, idUnidadeEscolar, req.userData.idUsuario);
    await ctrl.gerarRetornoOk(res);
    
}