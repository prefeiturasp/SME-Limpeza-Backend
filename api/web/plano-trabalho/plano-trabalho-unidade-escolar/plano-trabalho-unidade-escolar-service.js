const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const pdf = require('html-pdf');
const moment = require('moment');
const path = require('path');

const UsuarioCargoConstants = require('rfr')('core/constants/usuario-cargo.constantes');

const Dao = require('./plano-trabalho-unidade-escolar-dao');
const dao = new Dao();


exports.buscar = async (req, res) => {

  if (!req.params.id) {
    await ctrl.gerarRetornoErro(res);
  }

  if (!['ps', 'ue'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res);
  }

  const planoTrabalho = await dao.buscar(req.params.id);
  await ctrl.gerarRetornoOk(res, planoTrabalho);

}

exports.tabela = async (req, res) => {
  const params = await utils.getDatatableParams(req);
  const ehPrestadorServico = req.userData.origem.codigo === 'ps';
  const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : params.filters.unidadeEscolar?.id;
  const tabela = await dao.datatable(req.userData.idUsuario, ehPrestadorServico, idUnidadeEscolar, params.filters.idPeriodicidade, params.filters.idAmbienteUnidadeEscolar, params.filters.idTipoAmbiente, params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

exports.inserir = async (req, res) => {

  const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : req.body.unidadeEscolar?.id;
  const { idAmbienteGeral, idAmbienteUnidadeEscolarList, idPeriodicidade, idTurno, descricao } = req.body;
  let { dataInicial, diaSemana } = req.body;
  const flagAprovado = req.userData.origem.codigo === 'ue' && req.userData.cargo.id === UsuarioCargoConstants.RESPONSAVEL_UE;
  const flagFinalSemana = idPeriodicidade == 1 && req.body.flagFinalSemana === true;

  if (!idAmbienteGeral, !idAmbienteUnidadeEscolarList || !idPeriodicidade || !idTurno || !descricao) {
    return await ctrl.gerarRetornoErro(res);
  }

  if (idAmbienteUnidadeEscolarList.length == 0) {
    return await ctrl.gerarRetornoErro(res);
  }

  if (idPeriodicidade == 1) {
    dataInicial = null;
    diaSemana = null;
  } else if (idPeriodicidade == 2 || idPeriodicidade == 3) {
    dataInicial = null;
  } else if (idPeriodicidade == 4) {
    diaSemana = null;
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    for (let idAmbienteUnidadeEscolar of idAmbienteUnidadeEscolarList) {
      await dao.insert(_transaction, idUnidadeEscolar, idAmbienteUnidadeEscolar, idPeriodicidade, idTurno, descricao, diaSemana, dataInicial, flagFinalSemana, flagAprovado);
    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res);
  }

}

exports.atualizar = async (req, res) => {

  if (req.params.id != req.body.idPlanoTrabalhoUnidadeEscolar) {
    return await ctrl.gerarRetornoErro(res);
  }

  const { idAmbienteGeral, idAmbienteUnidadeEscolar, idPeriodicidade, idTurno, descricao } = req.body;
  let { dataInicial, diaSemana = false } = req.body;
  const flagFinalSemana = idPeriodicidade == 1 && req.body.flagFinalSemana === true;
  const flagAprovado = req.userData.origem.codigo === 'ue' && req.userData.cargo.id === UsuarioCargoConstants.RESPONSAVEL_UE;

  if (!idAmbienteGeral, !idAmbienteUnidadeEscolar || !idPeriodicidade || !idTurno || !descricao) {
    return await ctrl.gerarRetornoErro(res);
  }

  if (idPeriodicidade == 1) {
    dataInicial = null;
    diaSemana = null;
  } else if (idPeriodicidade == 2 || idPeriodicidade == 3) {
    dataInicial = null;
  } else if (idPeriodicidade == 4) {
    diaSemana = null;
  }

  try {
    await dao.atualizar(req.params.id, idAmbienteUnidadeEscolar, idPeriodicidade, idTurno, descricao, diaSemana, dataInicial, flagFinalSemana, flagAprovado);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

exports.remover = async (req, res) => {

  try {
    await dao.remover(req.params.id, req.userData.idOrigemDetalhe);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

exports.aprovar = async (req, res) => {

  if (req.userData.origem.codigo !== 'ue' || req.userData.cargo.id !== UsuarioCargoConstants.RESPONSAVEL_UE) {
    return await ctrl.gerarRetornoErro(res);
  }

  await dao.aprovar(req.params.id);
  await ctrl.gerarRetornoOk(res);

}

exports.exportarTodos = async (req, res) => {

  const params = await utils.getDatatableParams(req);
  const ehPrestadorServico = req.userData.origem.codigo === 'ps';
  const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : params.filters.unidadeEscolar?.id;

  let html = '';
  try {
    const planoTrabalhoList = await dao.buscarTodos(req.userData.idUsuario, ehPrestadorServico, idUnidadeEscolar, params.filters.idPeriodicidade, params.filters.idAmbienteUnidadeEscolar, params.filters.idTipoAmbiente);
    for (const [index, planoTrabalho] of Object(planoTrabalhoList).entries()) {
      const breakPage = index != 0 && (planoTrabalhoList.length - 1) != index;
      html += await montarHTML(planoTrabalho, breakPage);
    }

    const arquivo = await gerarArquivoPDF(html);

    if (!arquivo) {
      return await ctrl.gerarRetornoErro(res, 'Erro ao gerar o arquivo PDF.');
    }

    await ctrl.gerarRetornoOk(res, {
      name: 'SME-PLANO_TRABALHO-' + moment().format('YYYYMMDD-HHmmss'),
      extension: 'pdf',
      buffer: arquivo
    });

  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

// ##################################################################################################################
// utils
async function gerarArquivoPDF(html) {
  const phantomModule = require.resolve('phantomjs-prebuilt');
  const phantomRoot = path.dirname(phantomModule);
  const phantomPath = path.join(phantomRoot, 'phantom', 'bin', 'phantomjs');

  const options = {
    type: 'pdf',
    format: 'A4',
    orientation: 'portrait',
    border: '20mm',
    timeout: 300000,
    phantomPath
  };

  return new Promise((resolve, reject) => {
    pdf.create(html, options).toBuffer((error, buffer) => {
      if (!error) return resolve(buffer);
      console.error('Erro html-pdf:', error);
      return reject(error);
    });
  });
}

async function montarHTML(planoTrabalho, breakPage = false) {
  return `
    <style>${await utils.getExportCSS()}</style>
    <html style="zoom: 0.8;">
      <div class="w-100 h-100 text-center va-m" style="page-break-before: ${breakPage === true ? 'always' : 'avoid'}">
        <p class="fs-32 text-bold">${planoTrabalho.ambiente}</p>
        <p class="fs-10 text-left mt-50"><b>Tipo de Ambiente: </b> ${planoTrabalho.tipoAmbiente}</p>
        <p class="fs-10 text-left"><b>Turno: </b> ${planoTrabalho.turno.descricao}</p>
        <p class="fs-10 text-left"><b>Periodicidade: </b> ${planoTrabalho.periodicidade.descricao} ${planoTrabalho.diaSemana ? `(${utils.getWeekDayName(planoTrabalho.diaSemana)})` : ''}</p>
        <p class="fs-10 text-left"><b>Final de Semana: </b> ${planoTrabalho.flagFinalSemana ? 'Sim' : 'Não'}</p>
        <p class="fs-10 text-left"><b>Unidade Escolar: </b> ${planoTrabalho.unidadeEscolar.descricao}</p>
        <p class="fs-10 text-left mt-30"><b>Atividades:</b></p>
        <div class="w-100 fs-10 text-left">
          ${planoTrabalho.descricao}
        </div>
      </div>  
    </html>`;
}