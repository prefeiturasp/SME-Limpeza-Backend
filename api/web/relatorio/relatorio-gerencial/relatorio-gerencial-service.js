const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const moment = require('moment');

const serviceRelatorioModelo1 = require('../../../system/gerar-relatorio-gerencial-modelo1');
const serviceRelatorioModelo2 = require('../../../system/gerar-relatorio-gerencial-modelo2');

const Dao = require('./relatorio-gerencial-dao');
const OcorrenciaVariavelDao = require('../../ocorrencia/ocorrencia-variavel/ocorrencia-variavel-dao');
const UnidadeEscolarDao = require('../../unidade-escolar/unidade-escolar-dao');
const UsuarioDao = require('../../usuario/usuario/usuario-dao');
const ContratoDao = require('../../contrato/contrato-dao');

const dao = new Dao();
const ocorrenciaVariavelDao = new OcorrenciaVariavelDao();
const unidadeEscolarDao = new UnidadeEscolarDao();
const usuarioDao = new UsuarioDao();
const contratoDao = new ContratoDao();

exports.buscar = buscar;
exports.tabela = tabela;
exports.avaliar = avaliar;
exports.consolidar = consolidar;
exports.desconsolidar = desconsolidar;
exports.aprovar = aprovar;
exports.inserir = inserir;
exports.reverterAprovacao = reverterAprovacao;
exports.atualizarValorBruto = atualizarValorBruto;
exports.remover = remover;

exports.calcularTotal = calcularTotal;

async function buscar(req, res) {

  const idRelatorioGerencial = req.params.id;

  let relatorioGerencial = await dao.buscar(idRelatorioGerencial);

  if (!relatorioGerencial) {
    return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
  }

  if (req.userData.origem.codigo === 'ps' && relatorioGerencial.prestadorServico.id !== req.userData.idOrigemDetalhe) {
    return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
  }

  if (req.userData.origem.codigo === 'ue' && relatorioGerencial.unidadeEscolar.id !== req.userData.idOrigemDetalhe) {
    return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
  }

  const unidadeEscolar = await unidadeEscolarDao.findById(relatorioGerencial.unidadeEscolar.id);

  relatorioGerencial.flagPodeFiscalizar = await ctrl.verificarPodeFiscalizar(req.userData, relatorioGerencial.unidadeEscolar.id);
  relatorioGerencial.flagPodeAprovar = unidadeEscolar.idDiretoriaRegional === req.userData.idOrigemDetalhe;

  relatorioGerencial.flagAprovadoFiscal = (relatorioGerencial.idUsuarioAprovacaoFiscal && relatorioGerencial.dataHoraAprovacaoFiscal);
  relatorioGerencial.flagAprovadoDre = (relatorioGerencial.idUsuarioAprovacaoDre && relatorioGerencial.dataHoraAprovacaoDre);

  relatorioGerencial.valorDesconto = parseFloat(relatorioGerencial.valorBruto) * (parseFloat(relatorioGerencial.fatorDesconto) / 100);

  if (relatorioGerencial.contratoModelo === 2) {
    relatorioGerencial.equipeAlocada = await dao.buscarEquipeAlocada(idRelatorioGerencial);
  }

  await ctrl.gerarRetornoOk(res, relatorioGerencial);

}

async function tabela(req, res) {
  const params = await utils.getDatatableParams(req);
  const ehPrestadorServico = req.userData.origem.codigo === 'ps';
  const idPrestadorServico = ehPrestadorServico ? req.userData.idOrigemDetalhe : params.filters.prestadorServico?.id;
  const idDiretoriaRegional = req.userData.origem.codigo === 'dre' ? req.userData.idOrigemDetalhe : null;
  const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : params.filters.unidadeEscolar?.id;
  const idContratoPermissaoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const possuiPermissaoContratoFiltrado = (idContratoPermissaoList || []).some(c => c === params.filters.contrato?.id);
  const idContratoList = params.filters.contrato && possuiPermissaoContratoFiltrado ? [params.filters.contrato.id] : idContratoPermissaoList;
  const tabela = await dao.datatable(idPrestadorServico, idUnidadeEscolar, params.filters.ano, params.filters.mes, params.length, params.start, ehPrestadorServico, req.userData.idUsuario, idContratoList, idDiretoriaRegional);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

async function avaliar(req, res) {

  const { idRelatorioGerencial, idOcorrenciaVariavel, idOcorrenciaSituacao, observacao } = req.body;

  if (req.params.id !== idRelatorioGerencial) {
    return await ctrl.gerarRetornoErro(res);
  }

  const relatorioGerencial = await dao.findById(idRelatorioGerencial);

  if (!relatorioGerencial) {
    return await ctrl.gerarRetornoErro(res, 'Relatório gerencial não encontrado.');
  }

  const flagPodeFiscalizar = req.userData.origem.codigo === 'sme' || await ctrl.verificarPodeFiscalizar(req.userData, relatorioGerencial.idUnidadeEscolar);

  if (req.userData.origem.codigo !== 'sme' && (relatorioGerencial.idUsuarioAprovacaoFiscal || relatorioGerencial.idUsuarioAprovacaoDre)) {
    return await ctrl.gerarRetornoErro(res, 'Relatório gerencial já consolidado.');
  }

  if (!flagPodeFiscalizar) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para avaliar esse relatório gerencial.');
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    await atualizarOcorrenciaVariavel(_transaction, idRelatorioGerencial, idOcorrenciaVariavel, idOcorrenciaSituacao, observacao);
    await recalcularRelatorioGerencial(_transaction, idRelatorioGerencial);
    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res);
  }

}

async function consolidar(req, res) {

  const relatorioGerencial = await dao.findById(req.params.id);

  const flagPodeFiscalizar = await ctrl.verificarPodeFiscalizar(req.userData, relatorioGerencial.idUnidadeEscolar);

  if (!relatorioGerencial) {
    return await ctrl.gerarRetornoErro(res, 'Relatório gerencial não encontrado.');
  }

  if (!flagPodeFiscalizar) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para consolidar esse relatório gerencial.');
  }

  if (relatorioGerencial.idUsuarioAprovacaoFiscal || relatorioGerencial.idUsuarioAprovacaoDre) {
    return await ctrl.gerarRetornoErro(res, 'Relatório gerencial já consolidado.');
  }

  if (relatorioGerencial.pontuacaoFinal === null || relatorioGerencial.fatorDesconto === null) {
    return await ctrl.gerarRetornoErro(res, 'Existem itens pendentes de avaliação.');
  }

  const ocorrenciasAbertas = await dao.buscarOcorrenciasAbertas(req.params.id);

  if (ocorrenciasAbertas.length > 0) {
    return await ctrl.gerarRetornoErro(res, 'Existem ocorrências abertas.');
  }

  await dao.consolidar(req.params.id, req.userData.idUsuario, new Date());
  await ctrl.gerarRetornoOk(res);

}

async function desconsolidar(req, res) {

  const relatorioGerencial = await dao.findById(req.params.id);
  const unidadeEscolar = await unidadeEscolarDao.findById(relatorioGerencial.idUnidadeEscolar);

  if (!relatorioGerencial || !relatorioGerencial.idUsuarioAprovacaoFiscal) {
    return await ctrl.gerarRetornoErro(res, 'Relatório gerencial não encontrado.');
  }

  if (unidadeEscolar.idDiretoriaRegional !== req.userData.idOrigemDetalhe) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para reprovar esse relatório gerencial.');
  }

  if (relatorioGerencial.idUsuarioAprovacaoDre) {
    return await ctrl.gerarRetornoErro(res, 'Relatório gerencial já aprovado.');
  }

  await dao.desconsolidar(req.params.id);
  await ctrl.gerarRetornoOk(res);

}

async function aprovar(req, res) {

  const relatorioGerencial = await dao.findById(req.params.id);
  const unidadeEscolar = await unidadeEscolarDao.findById(relatorioGerencial.idUnidadeEscolar);

  if (!relatorioGerencial || !relatorioGerencial.idUsuarioAprovacaoFiscal) {
    return await ctrl.gerarRetornoErro(res, 'Relatório gerencial não encontrado.');
  }

  if (unidadeEscolar.idDiretoriaRegional !== req.userData.idOrigemDetalhe) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para aprovar esse relatório gerencial.');
  }

  if (relatorioGerencial.idUsuarioAprovacaoDre) {
    return await ctrl.gerarRetornoErro(res, 'Relatório gerencial já aprovado.');
  }

  await dao.aprovar(req.params.id, req.userData.idUsuario, new Date());
  await ctrl.gerarRetornoOk(res);

}

async function inserir(req, res) {

  const { idContrato, ano, mes, unidadeEscolar } = req.body;

  if (req.userData.origem.codigo !== 'sme') {
    return ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const detalhe = await dao.buscarConfiguracao(unidadeEscolar.id, parseInt(idContrato));

  if (!detalhe) {
    return ctrl.gerarRetornoErro(res);
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    const mesAnoCompetencia = moment(`${ano}-${mes}-01`, 'YYYY-MM-DD', true).format('YYYY-MM-DD');
    const dataInicial = moment.max(moment(mesAnoCompetencia).startOf('month'), moment(detalhe.dataInicial));
    const dataFinal = moment.min(moment(mesAnoCompetencia).endOf('month'), moment(detalhe.dataFinal));

    if (dataInicial.isAfter(moment(mesAnoCompetencia).endOf('month'))) {
      await ctrl.finalizarTransaction(false, _transaction);
      await ctrl.gerarRetornoErro(res, 'Unidade Escolar possui contrato com data inicial posterior à data de competência do boletim de medição.');
      return;
    }

    const ehMesCompleto = moment(mesAnoCompetencia).startOf('month').isSame(dataInicial, 'day') && moment(mesAnoCompetencia).endOf('month').isSame(dataFinal, 'day');
    const diasTrabalhados = ehMesCompleto ? 30 : parseInt(moment.duration(dataFinal.diff(dataInicial)).asDays());
    const reajustes = await contratoDao.buscarReajustes(idContrato);

    let valorMensal = parseFloat(detalhe.valor);
    for (const v of reajustes) {
      if (v.flagAtivo && moment(v.dataInicial).isSameOrBefore(moment().format('YYYY-MM-DD'))) {
        valorMensal += (valorMensal * (parseFloat(v.percentual) / 100));
      }
    }

    const valorDia = valorMensal / 30;
    const valorTotal = ehMesCompleto ? valorMensal : (valorDia * Math.abs(diasTrabalhados));

    const model = {
      idUnidadeEscolar: detalhe.idUnidadeEscolar,
      idPrestadorServico: detalhe.idPrestadorServico,
      idContrato: detalhe.idContrato,
    };

    switch (parseInt(detalhe.modelo)) {
      case 1: await serviceRelatorioModelo1._gerar(_transaction, model, dataInicial, dataFinal, valorTotal);
        break;
      case 2: await serviceRelatorioModelo2._gerar(_transaction, model, dataInicial, dataFinal, valorTotal);
        break;
      default: throw new Error('Modelo de contrato não implementado.');
    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, 'Desculpe, houve um erro ao processar sua solicitação.');
  }

}

async function reverterAprovacao(req, res) {

  const relatorioGerencial = await dao.findById(req.params.id);
  const unidadeEscolar = await unidadeEscolarDao.findById(relatorioGerencial.idUnidadeEscolar);

  if (!relatorioGerencial || !relatorioGerencial.idUsuarioAprovacaoDre) {
    return await ctrl.gerarRetornoErro(res, 'Relatório gerencial não encontrado.');
  }

  if (unidadeEscolar.idDiretoriaRegional !== req.userData.idOrigemDetalhe) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para alterar esse relatório gerencial.');
  }

  await dao.reverterAprovacao(req.params.id);
  await ctrl.gerarRetornoOk(res);

}

async function atualizarValorBruto(req, res) {

  const { idRelatorioGerencial, novoValorBruto } = req.body;

  if (req.userData.origem.codigo !== 'sme') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  if (parseInt(req.params.id) !== idRelatorioGerencial) {
    return await ctrl.gerarRetornoErro(res);
  }

  if (isNaN(novoValorBruto) || novoValorBruto < 0) {
    return await ctrl.gerarRetornoErro(res, 'O valor informado é inválido.');
  }

  const relatorioGerencial = await dao.findById(idRelatorioGerencial);

  if (!relatorioGerencial || relatorioGerencial.flagExcluido) {
    return await ctrl.gerarRetornoErro(res);
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    await dao.atualizarValorBruto(_transaction, idRelatorioGerencial, novoValorBruto);

    const valorDesconto = novoValorBruto * (parseFloat(relatorioGerencial.fatorDesconto) / 100);
    const novoValorLiquido = parseFloat(novoValorBruto) - parseFloat(valorDesconto) - parseFloat(relatorioGerencial.descontoGlosaRh ?? 0);
    const valorLiquidoFinal = novoValorLiquido >= 0.0 ? novoValorLiquido : 0.0;

    if (relatorioGerencial.contratoModelo === 1) {

      if (relatorioGerencial.pontuacaoFinal === null) {
        await dao.atualizarValorLiquido(_transaction, idRelatorioGerencial, valorLiquidoFinal);
      } else {
        await calcularTotal(_transaction, idRelatorioGerencial);
      }

    } else if (relatorioGerencial.contratoModelo === 2) {
      await dao.atualizarValorLiquido(_transaction, idRelatorioGerencial, valorLiquidoFinal);
    } else {
      throw Error();
    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res);
  }

}

async function remover(req, res) {

  const idRelatorioGerencial = parseInt(req.params.id);

  if (req.userData.origem.codigo !== 'sme') {
    return ctrl.gerarRetornoErro(res);
  }

  const relatorioGerencial = await dao.findById(idRelatorioGerencial);

  if (!relatorioGerencial) {
    return await ctrl.gerarRetornoErro(res);
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {
    await dao.removerDetalheTipo(_transaction, idRelatorioGerencial);
    await dao.removerDetalheVariavel(_transaction, idRelatorioGerencial);
    await dao.removerDetalheEquipeAlocada(_transaction, idRelatorioGerencial);
    await dao.remover(_transaction, idRelatorioGerencial);
    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res);
  }

}

async function atualizarOcorrenciaVariavel(_transaction, idRelatorioGerencial, idOcorrenciaVariavel, idOcorrenciaSituacao, observacao) {

  if (![1, 2, 3].includes(idOcorrenciaSituacao)) {
    throw new Error();
  }

  const nota = await calcularNotaOcorrenciaVariavel(idOcorrenciaSituacao);
  const peso = await calcularPesoOcorrenciaVariavel(idOcorrenciaVariavel);
  const pontuacao = parseFloat(nota).toFixed(2) * (peso / 100);

  return await dao.atualizarDetalheOcorrenciaVariavel(_transaction, idRelatorioGerencial, idOcorrenciaVariavel, idOcorrenciaSituacao, observacao, nota, peso, pontuacao);

}

async function calcularNotaOcorrenciaVariavel(idOcorrenciaSituacao) {

  switch (idOcorrenciaSituacao) {
    case 1: return 100;
    case 2: return 50;
    case 3: return 0;
  }

}

async function calcularPesoOcorrenciaVariavel(idOcorrenciaVariavel) {
  const ocorrenciaVariavel = await ocorrenciaVariavelDao.findById(idOcorrenciaVariavel);
  return ocorrenciaVariavel.peso;
}

async function recalcularRelatorioGerencial(_transaction, idRelatorioGerencial) {

  const relatorioGerencial = await dao.buscar(idRelatorioGerencial, _transaction);

  for (let tipo of relatorioGerencial.detalhe) {
    await calcularDetalhe(_transaction, idRelatorioGerencial, tipo);
  }

  await calcularTotal(_transaction, idRelatorioGerencial);

}

async function calcularDetalhe(_transaction, idRelatorioGerencial, tipo) {

  let pontuacaoParcial = 0;
  let tipoCompleto = true;
  for (let variavel of tipo.variaveis) {
    if (variavel.nota == null || variavel.peso == null || variavel.pontuacao == null) tipoCompleto = false;
    pontuacaoParcial += variavel.pontuacao;
  }

  if (tipoCompleto) {
    let pontuacaoFinal = parseFloat(pontuacaoParcial).toFixed(2) * (tipo.peso / 100);
    await dao.atualizarDetalheOcorrenciaTipo(_transaction, idRelatorioGerencial, tipo.idOcorrenciaTipo, pontuacaoParcial, pontuacaoFinal);
  }

}

async function calcularTotal(_transaction, idRelatorioGerencial) {

  const relatorioGerencial = await dao.buscar(idRelatorioGerencial, _transaction);
  let pontuacaoTotal = 0;
  let isCompleto = true;
  for (let tipo of relatorioGerencial.detalhe) {
    if (tipo.pontuacaoParcial == null || tipo.pontuacaoFinal == null) isCompleto = false;
    pontuacaoTotal += tipo.pontuacaoFinal;
  }

  if (!isCompleto) {
    return;
  }

  const fatorDesconto = await calcularFatorDesconto(pontuacaoTotal);
  const valorDesconto = relatorioGerencial.valorBruto * (fatorDesconto / 100);
  const valorLiquido = parseFloat(relatorioGerencial.valorBruto) - parseFloat(valorDesconto);
  const valorLiquidoFinal = valorLiquido >= 0.0 ? valorLiquido : 0.0;
  await dao.atualizarTotal(_transaction, idRelatorioGerencial, pontuacaoTotal, fatorDesconto, valorLiquidoFinal);

}

async function calcularFatorDesconto(pontuacaoTotal) {

  pontuacaoTotal = parseFloat(pontuacaoTotal).toFixed(2);

  if (pontuacaoTotal > 100) {
    throw new Error();
  }

  if (pontuacaoTotal >= 95.0) {
    return 0;
  }

  if (pontuacaoTotal >= 90.0) {
    return 1;
  }

  if (pontuacaoTotal >= 85.0) {
    return 2;
  }

  if (pontuacaoTotal >= 80.0) {
    return 3;
  }

  if (pontuacaoTotal >= 75.0) {
    return 4;
  }

  if (pontuacaoTotal >= 70.0) {
    return 5;
  }

  return 7.2;

}