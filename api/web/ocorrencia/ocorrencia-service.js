const ctrl = require('rfr')('core/controller.js');
const csv = require('rfr')('core/utils/csv.js');
const utils = require('rfr')('core/utils/utils.js');
const moment = require('moment');
const fs = require('fs');
const fse = require('fs-extra');

const serviceRelatorioModelo2 = require('../../system/gerar-relatorio-gerencial-modelo2');

const Dao = require('./ocorrencia-dao');
const UsuarioDao = require('../usuario/usuario/usuario-dao');
const UnidadeEscolarDao = require('../unidade-escolar/unidade-escolar-dao');
const MonitoramentoDao = require('../monitoramento/monitoramento-dao');
const DiretoriaRegionalDao = require('../diretoria-regional/diretoria-regional-dao');
const OcorrenciaVariavelDao = require('../ocorrencia/ocorrencia-variavel/ocorrencia-variavel-dao');
const ContratoDao = require('../contrato/contrato-dao');
const RelatorioGerencialDao = require('../relatorio/relatorio-gerencial/relatorio-gerencial-dao');

const dao = new Dao();
const usuarioDao = new UsuarioDao();
const unidadeEscolarDao = new UnidadeEscolarDao();
const monitoramentoDao = new MonitoramentoDao();
const diretoriaRegionalDao = new DiretoriaRegionalDao();
const ocorrenciaVariavelDao = new OcorrenciaVariavelDao();
const contratoDao = new ContratoDao();
const relatorioGerencialDao = new RelatorioGerencialDao();

exports.buscar = buscar;
exports.tabela = tabela;
exports.exportar = exportar;
exports.inserir = inserir;
exports.encerrar = encerrar;
exports.reabrir = reabrir;
exports.remover = remover;
exports.reincidenciaPorPrestador = reincidenciaPorPrestador;
exports.buscarUltimos = buscarUltimos;

async function buscar(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  try {
    let ocorrencia = await dao.buscar(req.params.id);
    ocorrencia = await buscarArquivos(ocorrencia);
    await ctrl.gerarRetornoOk(res, ocorrencia);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

async function reincidenciaPorPrestador(req, res) {
  const dataInicial = moment().format('YYYY-MM-DD');
  const dataFinal = moment().subtract(3, 'months').format('YYYY-MM-DD');
  const dados = {}; //await dao.reincidenciaPorPrestador(dataInicial, dataFinal);
  await ctrl.gerarRetornoOk(res, dados);
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
  const flagEncerrado = params.filters.flagEncerrado == undefined || params.filters.flagEncerrado == '' ? null : params.filters.flagEncerrado == 'true';
  const respondido = params.filters.respondido == undefined || params.filters.respondido == '' ? null : params.filters.respondido == 'true';
  const flagSomenteAtivos = params.filters.flagSomenteAtivos !== 'false';
  const ehPrestadorServico = req.userData.origem.codigo === 'ps';
  const idPrestadorServico = ehPrestadorServico ? req.userData.idOrigemDetalhe : params.filters.prestadorServico?.id;
  const idDiretoriaRegional = req.userData.origem.codigo === 'dre' ? req.userData.idOrigemDetalhe : null;
  
  const extrairIdsUE = (ue) => {
    if (!ue) return null;
    if (Array.isArray(ue)) {
      const ids = ue.map(x => Number(x?.id)).filter(Number.isFinite);
      return ids.length ? ids : null;
    }
    return ue.id != null ? [Number(ue.id)] : null;
  };
  let idUnidadeEscolarList = null;
  if (req.userData.origem.codigo === 'ue') {
    idUnidadeEscolarList = [Number(req.userData.idOrigemDetalhe)];
  } else {
    idUnidadeEscolarList = extrairIdsUE(params.filters.unidadeEscolar);
  }

  const idContratoPermissaoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const possuiPermissaoContratoFiltrado = (idContratoPermissaoList || []).some(c => c === params.filters.contrato?.id);
  const idContratoList = params.filters.contrato && possuiPermissaoContratoFiltrado ? [params.filters.contrato.id] : idContratoPermissaoList;

  const dataInicial = moment(params.filters.dataInicial).format('YYYY-MM-DD');
  const dataFinal = moment(params.filters.dataFinal).format('YYYY-MM-DD');
  const tabela = await dao.datatable(req.userData.idUsuario, ehPrestadorServico, idPrestadorServico, idUnidadeEscolarList, params.filters.idOcorrenciaTipo, dataInicial, dataFinal, flagEncerrado, flagSomenteAtivos, idContratoList, idDiretoriaRegional, respondido, params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

async function exportar(req, res) {

  const filtros = JSON.parse(req.query.filtros);
  const flagEncerrado = filtros.flagEncerrado == undefined || filtros.flagEncerrado == '' ? null : filtros.flagEncerrado == 'true';
  const flagSomenteAtivos = filtros.flagSomenteAtivos !== 'false';
  const ehPrestadorServico = req.userData.origem.codigo === 'ps';
  const idPrestadorServico = ehPrestadorServico ? req.userData.idOrigemDetalhe : filtros.prestadorServico?.id;
  const idDiretoriaRegional = req.userData.origem.codigo === 'dre' ? req.userData.idOrigemDetalhe : null;
  const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : filtros.unidadeEscolar?.id;

  const idContratoPermissaoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const possuiPermissaoContratoFiltrado = (idContratoPermissaoList || []).some(c => c === filtros.contrato?.id);
  const idContratoList = filtros.contrato && possuiPermissaoContratoFiltrado ? [filtros.contrato.id] : idContratoPermissaoList;

  const dataInicial = moment(filtros.dataInicial).format('YYYY-MM-DD');
  const dataFinal = moment(filtros.dataFinal).format('YYYY-MM-DD');
  const dados = await dao.exportar(req.userData.idUsuario, ehPrestadorServico, idPrestadorServico, idUnidadeEscolar, filtros.idOcorrenciaTipo, dataInicial, dataFinal, flagEncerrado, flagSomenteAtivos, idContratoList, idDiretoriaRegional);
  const csvString = await csv.converterFromJson(dados);
  await ctrl.gerarRetornoOk(res, csvString);
}

async function inserir(req, res) {

  if (req.userData.origem.codigo !== 'ue') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const { idOcorrenciaVariavel, observacao, flagAcaoImediata, acaoCorretiva, monitoramento } = req.body;
  const data = moment(req.body.data).format('YYYY-MM-DD HH:mm:ss');
  const idMonitoramento = monitoramento ? monitoramento.idMonitoramento : null;
  const equipeList = req.body.equipeList || [];

  if (monitoramento && (monitoramento.idOcorrencia || !monitoramento.flagPodeFiscalizar)) {
    return await ctrl.gerarRetornoErro(res, 'Não foi possível localizar a ocorrência.');
  }

  const arquivoList = req.body.arquivoList || [];
  const idUnidadeEscolar = req.userData.idOrigemDetalhe;
  const prestadorServico = await unidadeEscolarDao.buscarPrestadorServicoAtual(idUnidadeEscolar, data);
  const idFiscal = req.userData.idUsuario;

  if (flagAcaoImediata && !acaoCorretiva) {
    return await ctrl.gerarRetornoErro(res, 'Quando a ação imediata é selecionada, deve-se informar a ação corretiva.');
  }

  const ocorrenciaVariavel = await ocorrenciaVariavelDao.findById(idOcorrenciaVariavel);

  if (ocorrenciaVariavel && ocorrenciaVariavel.flagEquipeAlocada === true) {

    if (equipeList.length === 0) {
      return await ctrl.gerarRetornoErro(res, 'A relação de cargos não foi localizada.');
    }

    const incompleto = equipeList.filter(e => (e.quantidadeAusente < 0 || e.quantidadeAusente > e.quantidade));
    if (incompleto.length > 0) {
      return await ctrl.gerarRetornoErro(res, 'Houve um erro na validação dos cargos informados.');
    }
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    const idOcorrencia = await dao.insert(_transaction, idOcorrenciaVariavel, observacao, acaoCorretiva, data, idFiscal, idUnidadeEscolar, prestadorServico.idPrestadorServico, idMonitoramento);
    await salvarArquivos(_transaction, idOcorrencia, arquivoList);

    if(idOcorrencia && req.body.flagOcorrenciaRetroativa === true){
      await dao.updateOcorrenciaRetroativa(req.body.idOcorrenciaRetroativa, idOcorrencia, idFiscal, _transaction);
    }

    if (idMonitoramento) {
      await monitoramentoDao.setarOcorrencia(_transaction, idMonitoramento, idOcorrencia);
    }

    if (ocorrenciaVariavel.flagEquipeAlocada) {
      for (const c of equipeList) {
        const quantidadePresente = c.quantidade - c.quantidadeAusente;
        await dao.insertEquipe(_transaction, idOcorrencia, c.idCargo, c.quantidade, c.valorMensal, quantidadePresente, c.quantidadeAusente);
      }
    }

    await ctrl.finalizarTransaction(true, _transaction);
    await enviarEmailNovaOcorrencia(idOcorrencia);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res);
  }

}

async function encerrar(req, res) {

  if (req.userData.origem.codigo !== 'ue') {
    return await ctrl.gerarRetornoErro(res);
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    const flagGerarDesconto = req.body.flagGerarDesconto || false;
    const motivoNaoAtendido = req.body.motivoNaoAtendido || null;

    const idOcorrencia = req.params.id;
    const ocorrencia = await dao.buscar(idOcorrencia);
    console.log(ocorrencia);
    const dataHora = new Date();

    if (!ocorrencia || ocorrencia.dataHoraFinal) {
      await ctrl.finalizarTransaction(false, _transaction);
      return await ctrl.gerarRetornoErro(res, 'A ocorrência não foi localizada.');
    }

    if (moment().diff(moment(ocorrencia.dataHoraCadastro), 'hours') < 24) {
      await ctrl.finalizarTransaction(false, _transaction);
      return await ctrl.gerarRetornoErro(res, 'Encerrar uma ocorrência só é permitido após 24 horas do seu cadastro.');
    }

    await dao.encerrar(_transaction, idOcorrencia, dataHora, flagGerarDesconto, motivoNaoAtendido);

    const contrato = await unidadeEscolarDao.buscarContrato(ocorrencia.unidadeEscolar.id, ocorrencia.data);

    if (contrato?.modelo === 2 && flagGerarDesconto) {

      const mes = moment(ocorrencia.data).format('MM');
      const ano = moment(ocorrencia.data).format('YYYY');

      const mesmoMesAno = moment(ocorrencia.data).isSame(dataHora, 'month') && moment(ocorrencia.data).isSame(dataHora, 'year');
      const relatorioGerencial = await relatorioGerencialDao.buscarPorCompetenciaAndContrato(ano, mes, ocorrencia.unidadeEscolar.id, ocorrencia.prestadorServico.id, contrato.idContrato, contrato.modelo);

      if (relatorioGerencial) {

        await relatorioGerencialDao.removerDetalheTipo(_transaction, relatorioGerencial.idRelatorioGerencial);
        await relatorioGerencialDao.removerDetalheVariavel(_transaction, relatorioGerencial.idRelatorioGerencial);
        await relatorioGerencialDao.removerDetalheEquipeAlocada(_transaction, relatorioGerencial.idRelatorioGerencial);
        await relatorioGerencialDao.remover(_transaction, relatorioGerencial.idRelatorioGerencial);

        const dataInicial = moment(ocorrencia.data).startOf('month');
        const dataFinal = moment(ocorrencia.data).endOf('month');

        const model = {
          idUnidadeEscolar: relatorioGerencial.idUnidadeEscolar,
          idPrestadorServico: relatorioGerencial.idPrestadorServico,
          idContrato: relatorioGerencial.idContrato,
        }

        await serviceRelatorioModelo2._gerar(_transaction, model, dataInicial, dataFinal, relatorioGerencial.valorBruto);

      }

    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res);
  }

}

async function reabrir(req, res) {

  if (req.userData.origem.codigo !== 'dre') {
    return await ctrl.gerarRetornoErro(res);
  }

  const idOcorrencia = req.params.id;

  try {
    const ocorrencia = await dao.buscar(idOcorrencia);
    if (!ocorrencia || !ocorrencia.flagEncerrado) {
      return await ctrl.gerarRetornoErro(res);
    }
    await dao.reabrir(idOcorrencia);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

async function remover(req, res) {

  const idOcorrencia = req.params.id;
  const ocorrencia = await dao.buscar(idOcorrencia);

  if (!ocorrencia) {
    return await ctrl.gerarRetornoErro(res, 'Ocorrência não encontrada.');
  }

  if (req.userData.origem.codigo !== 'dre' && req.userData.origem.codigo !== 'ue') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação (01).');
  }

  if (req.userData.origem.codigo === 'dre') {
    const idDiretoriaRegional = req.userData.idOrigemDetalhe;
    if (ocorrencia.unidadeEscolar.idDiretoriaRegional !== idDiretoriaRegional) {
      return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação (02).');
    }
  }

  if (req.userData.origem.codigo === 'ue') {
    const flagPodeFiscalizar = await ctrl.verificarPodeFiscalizar(req.userData, ocorrencia.unidadeEscolar.id);
    if (!flagPodeFiscalizar) {
      return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação (03).');
    }
  }

  const idUsuarioRemocao = req.userData.idUsuario;
  const _transaction = await ctrl.iniciarTransaction();

  try {

    // await dao.removerArquivos(idOcorrencia, _transaction);
    // await dao.removerEquipes(idOcorrencia, _transaction);
    // await dao.removerMensagens(idOcorrencia, _transaction);
    await dao.removerVinculoMonitoramento(idOcorrencia, _transaction);
    await dao.remover(idOcorrencia, idUsuarioRemocao, _transaction);

    const contrato = await unidadeEscolarDao.buscarContrato(ocorrencia.unidadeEscolar.id, ocorrencia.data);

    if (contrato && ocorrencia.flagGerarDesconto) {

      const mes = moment(ocorrencia.data).format('MM');
      const ano = moment(ocorrencia.data).format('YYYY');

      const relatorioGerencial = await relatorioGerencialDao.buscarPorCompetenciaAndContrato(ano, mes, ocorrencia.unidadeEscolar.id, ocorrencia.prestadorServico.id, contrato.idContrato, contrato.modelo);

      if (relatorioGerencial) {

        if (relatorioGerencial.dataHoraAprovacaoFiscal) {
          await ctrl.finalizarTransaction(false, _transaction);
          return await ctrl.gerarRetornoErro(res, 'Não é possível remover ocorrência com vínculo de boletim de medição já aprovado pelo fiscal.');
        }

        if (contrato.modelo === 2) {

          await relatorioGerencialDao.removerDetalheTipo(_transaction, relatorioGerencial.idRelatorioGerencial);
          await relatorioGerencialDao.removerDetalheVariavel(_transaction, relatorioGerencial.idRelatorioGerencial);
          await relatorioGerencialDao.removerDetalheEquipeAlocada(_transaction, relatorioGerencial.idRelatorioGerencial);
          await relatorioGerencialDao.remover(_transaction, relatorioGerencial.idRelatorioGerencial);

          const dataInicial = moment(ocorrencia.data).startOf('month');
          const dataFinal = moment(ocorrencia.data).endOf('month');

          const model = {
            idUnidadeEscolar: relatorioGerencial.idUnidadeEscolar,
            idPrestadorServico: relatorioGerencial.idPrestadorServico,
            idContrato: relatorioGerencial.idContrato,
          }

          await serviceRelatorioModelo2._gerar(_transaction, model, dataInicial, dataFinal, relatorioGerencial.valorBruto);

        }

      }

    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res);
  }

}

async function buscarArquivos(ocorrencia) {

  try {

    for (let arquivo of ocorrencia.arquivos) {
      arquivo.base64 = await fs.readFileSync(arquivo.caminho, { encoding: 'base64' });
      delete arquivo.caminho;
    }

    return ocorrencia;

  } catch (error) {
    console.log(error);
    throw new Error();
  }

}

async function salvarArquivos(_transaction, idOcorrencia, arquivoList) {

  const PATH_ARQUIVOS = `${process.env.FILES}/${moment().format('YYYY')}/${moment().format('MM')}/${moment().format('DD')}/`;

  try {

    for (let arquivo of arquivoList) {
      let base64Data = arquivo.base64.replace(/^data:image\/png;base64,/, '');
      let caminhoCompleto = PATH_ARQUIVOS + arquivo.filename;
      await dao.inserirArquivo(_transaction, idOcorrencia, arquivo.filename, arquivo.filesize, caminhoCompleto);
      await fse.outputFileSync(caminhoCompleto, base64Data, 'base64');
    }

  } catch (error) {
    console.log(error);
    throw new Error();
  }

}

async function enviarEmailNovaOcorrencia(idOcorrencia) {

  const ocorrencia = await dao.buscar(idOcorrencia);
  const diretoriaRegional = await diretoriaRegionalDao.buscar(ocorrencia.unidadeEscolar.idDiretoriaRegional);
  const emailUsuarioPrestadorServicoList = (await usuarioDao.buscarPrestadorPorUnidadeEscolar(ocorrencia.unidadeEscolar.id)).map(u => u.email);
  const linkOcorrencia = process.env.FRONTEND_URL + '/ocorrencia/detalhe/' + idOcorrencia;

  const html = `
        Olá,
        <br><br>
        Uma nova ocorrência foi protocolada!
        <br>
        <br><b>UNIDADE ESCOLAR:</b> ${ocorrencia.unidadeEscolar.codigo} | ${ocorrencia.unidadeEscolar.descricao}
        <br><b>PRESTADOR DE SERVIÇO:</b> ${ocorrencia.prestadorServico.razaoSocial}
        <br><br>
        Para visualizar os detalhes da ocorrência, <a href="${linkOcorrencia}" target="_blank">Clique aqui</a>.
        <br><br><br>
        E-mail enviado automaticamente, favor não responder.
    `;

  const destinatario = ocorrencia.prestadorServico.email + ',' + diretoriaRegional.email + ',' + emailUsuarioPrestadorServicoList.join(',');
  ctrl.enviarEmail(destinatario, 'Nova Ocorrência', html);

}