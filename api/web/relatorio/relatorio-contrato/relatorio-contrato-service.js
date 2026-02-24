const ctrl = require('rfr')('core/controller.js');
const csv = require('rfr')('core/utils/csv.js');
const utils = require('rfr')('core/utils/utils.js');

const relatorioGerencialService = require('../relatorio-gerencial/relatorio-gerencial-service');

const Dao = require('./relatorio-contrato-dao');
const ContratoDao = require('../../contrato/contrato-dao');
const PrestadorServicoDao = require('../../prestador-servico/prestador-servico-dao');
const UsuarioDao = require('../../usuario/usuario/usuario-dao');
const RelatorioGerencialDao = require('../relatorio-gerencial/relatorio-gerencial-dao');

const dao = new Dao();
const contratoDao = new ContratoDao();
const prestadorServicoDao = new PrestadorServicoDao();
const usuarioDao = new UsuarioDao();
const relatorioGerencialDao = new RelatorioGerencialDao();

exports.buscar = buscar;
exports.exportar = exportar;
exports.tabela = tabela;
exports.importar = importar;

async function buscar(req, res) {

  if (!['dre', 'ps', 'sme'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const { ano, mes, idContrato } = req.query;
  const idPrestadorServico = req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : req.query.idPrestadorServico;

  const contrato = await contratoDao.buscar(idContrato);
  const relatorioList = await dao.buscarRelatoriosUnidadeEscolar(ano, mes, idContrato, idPrestadorServico);

  if (!contrato || relatorioList.length === 0) {
    return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
  }

  const totalEquipe = Object.values(
    relatorioList.reduce((acc, rel) => {
      (rel.quantidadeEquipeTotal || []).forEach(cargo => {
        const key = cargo.idCargo;
        if (!acc[key]) {
          acc[key] = {
            idCargo: cargo.idCargo,
            descricao: cargo.descricao,
            quantidadeContratada: 0,
            valorMensal: cargo.valorMensal,
            quantidadeAusente: 0,
            valorDesconto: 0
          };
        }
        acc[key].quantidadeContratada += Number(cargo.quantidadeContratada) || 0;
        acc[key].quantidadeAusente += Number(cargo.quantidadeAusente) || 0;
        acc[key].valorDesconto += Number(cargo.valorDesconto) || 0;
      });
      return acc;
    }, {})
  );

  const response = {
    ano: ano,
    mes: mes,
    contrato: contrato,
    prestadorServico: await prestadorServicoDao.buscar(idPrestadorServico),
    relatorioList: relatorioList,
    flagAprovadoFiscal: relatorioList.every(c => c.flagAprovadoFiscal === true),
    flagAprovadoDre: relatorioList.every(c => c.flagAprovadoDre === true),
    valorBruto: relatorioList.reduce((soma, c) => soma + parseFloat(c.valorBruto), 0),
    valorLiquido: relatorioList.reduce((soma, c) => soma + parseFloat(c.valorLiquido), 0),
    valorDesconto: relatorioList.reduce((soma, c) => soma + parseFloat(c.valorDesconto), 0),
    valorDescontoGlosaRh: relatorioList.reduce((soma, c) => soma + parseFloat(c.descontoGlosaRh), 0),
    totalFaltasFuncionarios: relatorioList.reduce((soma, c) => soma + parseFloat(c.quantidadeAusenteTotal), 0),
    totalEquipe
  };

  await ctrl.gerarRetornoOk(res, response);

}

async function exportar(req, res) {

  if (!['dre', 'ps', 'sme'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const { ano, mes, idContrato } = req.query;
  const idPrestadorServico = req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : req.query.idPrestadorServico;

  const contrato = await contratoDao.buscar(idContrato);
  const prestadorServico = await prestadorServicoDao.buscar(idPrestadorServico);
  const relatorioList = await dao.buscarRelatoriosUnidadeEscolar(ano, mes, idContrato, idPrestadorServico);

  if (!contrato || relatorioList.length === 0) {
    return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
  }

  const valorLiquido = relatorioList.reduce((soma, c) => soma + parseFloat(c.valorLiquido), 0);
  const valorDesconto = relatorioList.reduce((soma, c) => soma + parseFloat(c.valorDesconto), 0);

  const objtoExportacao = [];

  for (const rg of relatorioList) {

    let objeto = {
      ano: ano,
      mes: mes,
      numeroPregao: contrato.numeroPregao,
      nomeLote: contrato.nomeLote,
      termoContrato: contrato.codigo,
      totalContrato: parseFloat(contrato.valorTotal).toFixed(2).toString().replace('.', ','),
      descontoContrato: parseFloat(valorDesconto).toFixed(2).toString().replace('.', ','),
      liquidoContrato: parseFloat(valorLiquido).toFixed(2).toString().replace('.', ','),
      nomeEmpresa: prestadorServico.razaoSocial,
      codigoUnidadeEscolar: rg.unidadeEscolar.codigo,
      tipoUnidadeEscolar: rg.unidadeEscolar.tipo,
      nomeUnidadeEscolar: rg.unidadeEscolar.descricao,
      nomeFiscal: rg.nomeFiscalAprovacao || ' - ',
      totalUnidade: parseFloat(rg.valorBruto).toFixed(2).toString().replace('.', ','),
      glosaImrUnidade: parseFloat(rg.valorDesconto).toFixed(2).toString().replace('.', ','),
    };

    if (contrato.modelo === '2') {
      objeto.glosaRhUnidade = parseFloat(rg.descontoGlosaRh).toFixed(2).toString().replace('.', ',');
    }

    objeto.liquidoUnidade = parseFloat(rg.valorLiquido).toFixed(2).toString().replace('.', ',');
    objeto.percentualImrUnidade = rg.fatorDesconto ? parseFloat(rg.fatorDesconto).toFixed(2).toString().replace('.', ',') : ' - ';
    objeto.pontuacaoUnidade = rg.pontuacaoFinal ? parseFloat(rg.pontuacaoFinal).toFixed(2).toString().replace('.', ',') : ' - ';

    objtoExportacao.push(objeto);

  }

  const csvString = await csv.converterFromJson(objtoExportacao);
  await ctrl.gerarRetornoOk(res, csvString);

}

async function tabela(req, res) {
  const params = await utils.getDatatableParams(req);
  const idPrestadorServico = req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : params.filters.prestadorServico?.id;
  const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : params.filters.unidadeEscolar?.id;
  const idDiretoriaRegional = req.userData.origem.codigo === 'dre' ? req.userData.idOrigemDetalhe : null;
  const idContratoPermissaoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const possuiPermissaoContratoFiltrado = (idContratoPermissaoList || []).some(c => c === params.filters.contrato?.id);
  const idContratoList = params.filters.contrato && possuiPermissaoContratoFiltrado ? [params.filters.contrato.id] : idContratoPermissaoList;
  const tabela = await dao.datatable(idPrestadorServico, idUnidadeEscolar, params.filters.ano, params.filters.mes, idContratoList, idDiretoriaRegional, params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

async function importar(req, res) {

  if (req.userData.origem.codigo !== 'sme') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const { ano, mes, idContrato } = req.query;
  const idPrestadorServico = req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : req.query.idPrestadorServico;

  const contrato = await contratoDao.buscar(idContrato);
  const relatorioList = await dao.buscarRelatoriosUnidadeEscolar(ano, mes, idContrato);

  if (!contrato || relatorioList.length === 0) {
    return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    const unidadeEscolarList = await csv.converterFromCsv(req.file);

    const estrutura = ['codigo_ue', 'valor'];
    const estruturaInvalida = await csv.verificarEstruturaInvalida(unidadeEscolarList, estrutura);

    if (estruturaInvalida) {
      throw estruturaInvalida;
    }

    for (const ue of unidadeEscolarList) {

      const ueExiste = relatorioList.find(r => r.unidadeEscolar.codigo === ue.codigo_ue);

      if (!ueExiste) {
        ue.classeResultado = 'danger';
        ue.mensagemResultado = `UE não encontrada.`;
        continue;
      }

      ue.descricao = ueExiste.unidadeEscolar.descricao;
      ue.valor = utils.parseNumberCsv(ue.valor);

      if (isNaN(ue.valor) || ue.valor < 0.0) {
        ue.classeResultado = 'danger';
        ue.mensagemResultado = `Valor inválido.`;
        continue;
      }

      const relatorioGerencial = await relatorioGerencialDao.findById(ueExiste.idRelatorioGerencial);
      await relatorioGerencialDao.atualizarValorBruto(_transaction, ueExiste.idRelatorioGerencial, ue.valor);

      if (relatorioGerencial.contratoModelo === 1) {

        if (relatorioGerencial.pontuacaoFinal === null) {
          await relatorioGerencialDao.atualizarValorLiquido(_transaction, ueExiste.idRelatorioGerencial, ue.valor);
        } else {
          await relatorioGerencialService.calcularTotal(_transaction, ueExiste.idRelatorioGerencial);
        }

      } else if (relatorioGerencial.contratoModelo === 2) {

        const valorDesconto = ue.valor * (parseFloat(relatorioGerencial.fatorDesconto) / 100);

        const descontoGlosaRh = (await relatorioGerencialDao.calcularDescontoGlosaRh(_transaction, ueExiste.idRelatorioGerencial)).total || 0.0;
        const valorLiquido = parseFloat(ue.valor - parseFloat(valorDesconto)) - (parseFloat(descontoGlosaRh) || 0.0);
        const valorLiquidoFinal = valorLiquido >= 0.0 ? valorLiquido : 0.0;

        await relatorioGerencialDao.atualizarValorLiquido(_transaction, ueExiste.idRelatorioGerencial, valorLiquidoFinal);

      } else {
        ue.classeResultado = 'danger';
        ue.mensagemResultado = `Contrato inválido.`;
        continue;
      }

      ue.classeResultado = 'success';
      ue.mensagemResultado = 'Atualizado com sucesso.';

    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res, unidadeEscolarList);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, typeof error === 'string' ? error : null);
  }

}