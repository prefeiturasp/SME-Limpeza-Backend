const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const csv = require('rfr')('core/utils/csv.js');
const jsZip = require('jszip');
const pdf = require('html-pdf');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const moment = require('moment');
const path = require('path');

const Dao = require('./ambiente-unidade-escolar-dao');
const DaoUnidadeEscolar = require('../../../unidade-escolar/unidade-escolar-dao');
const DaoAmbienteGeral = require('../ambiente-geral/ambiente-geral-dao');
const DaoTipoAmbiente = require('../tipo-ambiente/tipo-ambiente-dao');
const DaoUsuario = require('../../../usuario/usuario/usuario-dao');

const dao = new Dao();
const daoUnidadeEscolar = new DaoUnidadeEscolar();
const daoAmbienteGeral = new DaoAmbienteGeral();
const daoTipoAmbiente = new DaoTipoAmbiente();
const daoUsuario = new DaoUsuario();

exports.buscar = buscar;
exports.buscarPorHash = buscarPorHash;
exports.tabela = tabela;
exports.importar = importar;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;
exports.combo = combo;
exports.comboPorAmbienteGeral = comboPorAmbienteGeral;
exports.qrcode = qrcode;
exports.gerarTodosQRCode = gerarTodosQRCode;

async function buscar(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const ambiente = await dao.findById(req.params.id);

  if (req.userData.origem.codigo != 'sme' && ambiente.idUnidadeEscolar != req.userData.idOrigemDetalhe) {
    return await ctrl.gerarRetornoErro(res);
  }

  await ctrl.gerarRetornoOk(res, ambiente);

}

async function buscarPorHash(req, res) {

  if (req.userData.origem.codigo != 'ue') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const idUnidadeEscolar = req.userData.idOrigemDetalhe;

  if (!req.body.hash) {
    return await ctrl.gerarRetornoErro(res);
  }

  const ambiente = await dao.buscarPorHash(req.body.hash, idUnidadeEscolar);
  await ctrl.gerarRetornoOk(res, ambiente);

}

async function tabela(req, res) {

  const params = await utils.getDatatableParams(req);
  const idUnidadeEscolar = req.userData.origem.codigo != 'sme'
    ? req.userData.idOrigemDetalhe
    : (params.filters.idUnidadeEscolar?.id || null);
  const idContratoList = req.userData.origem.codigo !== 'sme' ? null : (await daoUsuario.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const tabela = await dao.datatable(idUnidadeEscolar, params.filters.descricao, params.filters.idTipoAmbiente, params.filters.idDiretoriaRegional?.id, idContratoList, params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);

}

async function importar(req, res) {

  if (req.userData.origem.codigo != 'sme') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    const ambienteUnidadeEscolarList = await csv.converterFromCsv(req.file);
    const estrutura = ['descricao', 'ambiente_geral_descricao', 'codigo_ue', 'tipo', 'area'];
    const estruturaInvalida = await csv.verificarEstruturaInvalida(ambienteUnidadeEscolarList, estrutura);

    if (estruturaInvalida) {
      throw estruturaInvalida;
    }

    for (const aue of ambienteUnidadeEscolarList) {

      aue.area = parseFloat(aue.area).toFixed(2);

      if (isNaN(aue.area)) {
        aue.classeResultado = 'danger';
        aue.mensagemResultado = `Área inválida`;
        continue;
      }

      const tipoAmbiente = await daoTipoAmbiente.buscarPorCodigo(aue.tipo);

      if (!tipoAmbiente) {
        aue.classeResultado = 'danger';
        aue.mensagemResultado = `Tipo inválido`;
        continue;
      }

      aue.tipoAmbiente = tipoAmbiente;

      const unidadeEscolar = await daoUnidadeEscolar.buscarPorCodigo(aue.codigo_ue);
      if (!unidadeEscolar) {
        aue.classeResultado = 'danger';
        aue.mensagemResultado = `Unidade Escolar inválida`;
        continue;
      }

      aue.unidadeEscolar = unidadeEscolar;

      if (!unidadeEscolar.flagAtivo) {
        aue.classeResultado = 'danger';
        aue.mensagemResultado = `Unidade Escolar inativa`;
        continue;
      }

      const ambienteGeral = await daoAmbienteGeral.buscarPorDescricao(aue.ambiente_geral_descricao);

      if (!ambienteGeral || !ambienteGeral.flagAtivo) {
        aue.classeResultado = 'danger';
        aue.mensagemResultado = `Ambiente Geral inválido`;
        continue;
      }

      aue.ambienteGeral = ambienteGeral;

      const aueExistente = await dao.buscarPorDescricaoAndAtivo(aue.descricao, _transaction);

      if (aueExistente && aueExistente.idAmbienteGeral == ambienteGeral.id && aueExistente.idUnidadeEscolar == unidadeEscolar.id) {
        aue.classeResultado = 'info';
        aue.mensagemResultado = 'Já Existe';
      } else {
        aue.classeResultado = 'success';
        aue.mensagemResultado = 'Cadastrado com sucesso';
        aue.descricao = aueExistente?.descricao ? aueExistente.descricao : aue.descricao;
        const id = await dao.insert(unidadeEscolar.id, ambienteGeral.id, aue.descricao, aue.area, _transaction);
        await processarHash(id, _transaction);
      }

    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res, ambienteUnidadeEscolarList);

  } catch (error) {
    console.log({ error })
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, typeof error == 'string' ? error : null);
  }

}

async function inserir(req, res) {

  if (!['sme', 'ue'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const idUnidadeEscolar = req.userData.origem.codigo === 'sme' ? req.body.unidadeEscolar?.id : req.userData.idOrigemDetalhe;

  const { idAmbienteGeral, descricao, areaAmbiente } = req.body;

  if (!idUnidadeEscolar || !idAmbienteGeral || !descricao) {
    return await ctrl.gerarRetornoErro(res);
  }

  const areaPadrao = (areaAmbiente === undefined || areaAmbiente === null || areaAmbiente === '')
    ? 0
    : Number(areaAmbiente); // garante número se vier como string

  const id = await dao.insert(idUnidadeEscolar, idAmbienteGeral, descricao, areaPadrao);
  await processarHash(id);
  await ctrl.gerarRetornoOk(res);

}

async function atualizar(req, res) {

  if (!['sme', 'ue'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const { id, idAmbienteGeral, descricao, areaAmbiente } = req.body;

  if (req.params.id != id) {
    return await ctrl.gerarRetornoErro(res);
  }

  await dao.atualizar(req.params.id, idAmbienteGeral, descricao, areaAmbiente);
  await ctrl.gerarRetornoOk(res);

}

async function remover(req, res) {

  if (req.userData.origem.codigo != 'sme') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  await dao.remover(req.params.id);
  await ctrl.gerarRetornoOk(res);

}

async function combo(req, res) {

  const idUnidadeEscolar = req.userData.origem.codigo == 'ue' ? req.userData.idOrigemDetalhe : req.params.idUnidadeEscolar;

  try {
    const combo = await dao.combo(idUnidadeEscolar);
    await ctrl.gerarRetornoOk(res, combo);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

async function comboPorAmbienteGeral(req, res) {

  const idUnidadeEscolar = req.userData.origem.codigo == 'ue' ? req.userData.idOrigemDetalhe : req.params.idUnidadeEscolar;

  try {
    const combo = await dao.comboPorAmbienteGeral(idUnidadeEscolar, req.params.idAmbienteGeral);
    await ctrl.gerarRetornoOk(res, combo);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

async function gerarTodosQRCode(req, res) {

  const idUnidadeEscolar = req.userData.origem.codigo == 'ue' ? req.userData.idOrigemDetalhe : req.params.idUnidadeEscolar;
  let html = '';
  try {
    const ambienteUnidadeEscolarList = await dao.combo(idUnidadeEscolar);
    for (const [index, aue] of Object(ambienteUnidadeEscolarList).entries()) {
      const ambienteUnidadeEscolar = await dao.buscarDadosQRCode(aue.id);
      const base64 = await gerarBase64QRCode(ambienteUnidadeEscolar.hash);
      if (!base64) throw new Error();
      const breakPage = index != 0 && (ambienteUnidadeEscolarList.length - 1) != index;
      html += await montarHTML(ambienteUnidadeEscolar, base64, breakPage);
    }

    const arquivo = await gerarArquivoPDF(html);

    if (!arquivo) {
      return await ctrl.gerarRetornoErro(res, 'Erro ao gerar o arquivo PDF.');
    }

    await ctrl.gerarRetornoOk(res, {
      name: 'SME-QRCODE-' + moment().format('YYYYMMDD-HHmmss'),
      extension: 'pdf',
      buffer: arquivo
    });

  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

async function qrcode(req, res) {

  const idAmbienteUnidadeEscolar = req.params.id;

  if (!idAmbienteUnidadeEscolar) {
    return await ctrl.gerarRetornoErro(res);
  }

  const ambienteUnidadeEscolar = await dao.buscarDadosQRCode(idAmbienteUnidadeEscolar);

  if (!ambienteUnidadeEscolar) {
    return await ctrl.gerarRetornoErro(res, 'Ambiente não encontrado.');
  }

  const base64 = await gerarBase64QRCode(ambienteUnidadeEscolar.hash);

  if (!base64) {
    return await ctrl.gerarRetornoErro(res, 'Erro ao gerar o QRCode.');
  }

  const html = await montarHTML(ambienteUnidadeEscolar, base64);
  const arquivo = await gerarArquivoPDF(html);

  if (!arquivo) {
    return await ctrl.gerarRetornoErro(res, 'Erro ao gerar o arquivo PDF.');
  }

  await ctrl.gerarRetornoOk(res, {
    name: 'SME-QRCODE-' + moment().format('YYYYMMDD-HHmmss'),
    extension: 'pdf',
    buffer: arquivo
  });

}

function gerarBase64QRCode(hash) {
  return QRCode.toDataURL(hash)
    .then(url => url)
    .catch(err => null);
}

async function processarHash(id, _transaction) {
  const hash = bcrypt.hashSync(id.toString(), 10);
  console.log(hash)
  await dao.atualizarHash(id, hash, _transaction);
}

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

async function montarHTML(ambienteUnidadeEscolar, base64, breakPage = false) {
  return `
        <style>${await utils.getExportCSS()}</style>
        <html style="zoom: 0.8;">
            <div class="w-100 h-100 text-center va-m" style="page-break-before: ${breakPage === true ? 'always' : 'avoid'}">
                <p class="fs-28 text-bold">${ambienteUnidadeEscolar.descricao}</p>
                <img src="${base64}" class="responsive-qrcode"></img>
                <p class="fs-10 text-left mt-30"><b>Tipo de Ambiente: </b> ${ambienteUnidadeEscolar.tipoAmbiente}</p>
                <p class="fs-10 text-left"><b>Unidade Escolar: </b> ${ambienteUnidadeEscolar.unidadeEscolar}</p>
                <p class="fs-10 text-left"><b>DRE: </b> ${ambienteUnidadeEscolar.diretoriaRegional}</p>
                <p class="fs-8 mt-50">${ambienteUnidadeEscolar.hash}</p>
            </div>
        </html>
    `;
}