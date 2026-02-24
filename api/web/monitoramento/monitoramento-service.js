const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const moment = require('moment');

const UsuarioCargoConstants = require('rfr')('core/constants/usuario-cargo.constantes');
const Dao = require('./monitoramento-dao');
const UnidadeEscolarDao = require('../unidade-escolar/unidade-escolar-dao');
const DaoUsuario = require('../usuario/usuario/usuario-dao');

const dao = new Dao();
const unidadeEscolarDao = new UnidadeEscolarDao();
const daoUsuario = new DaoUsuario();

exports.buscar = buscar;
exports.tabela = tabela;
exports.tabelaDatasAgendamentoManual = tabelaDatasAgendamentoManual;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;

async function buscar(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  try {
    let monitoramento = await dao.buscar(req.params.id);
    monitoramento.flagPodeFiscalizar = await ctrl.verificarPodeFiscalizar(req.userData, monitoramento.unidadeEscolar.idUnidadeEscolar);
    await ctrl.gerarRetornoOk(res, monitoramento);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

async function tabela(req, res) {
  try {
    const params = await utils.getDatatableParams(req);
    const origem = req.userData.origem.codigo;
    const temFiltroImplicito = origem === 'ps' || origem === 'dre' || origem === 'ue';
    const filters = params.filters || {};
    const idUnidadeEscolar = origem === 'ue' ? req.userData.idOrigemDetalhe : filters?.unidadeEscolar?.id || null;
    const idDiretoriaRegional = origem === 'dre' ? req.userData.idOrigemDetalhe : null;
    const idAmbienteUnidadeEscolar = filters?.idAmbienteUnidadeEscolar || null;
    const idPrestadorServico = origem === 'ps' ? req.userData.idOrigemDetalhe : filters?.prestadorServico?.id || null;
    const datasList = Array.isArray(filters?.datas) && filters.datas.length ? filters.datas : null;
    const idContratoFiltro = filters?.contrato?.id || null;

    const temFiltroExplicito =
      !!datasList ||
      !!idUnidadeEscolar ||
      !!idAmbienteUnidadeEscolar ||
      !!idContratoFiltro ||
      !!idPrestadorServico;

    if (!temFiltroImplicito && !temFiltroExplicito) {
      return res.json({
        datatables: {
          recordsFiltered: 0,
          recordsTotal: 0,
          teste: "vazio1111",
          data: []
        }
      });
    }

    const idContratoList = origem !== 'sme'
      ? null
      : await (async () => {
        const contratos = (await daoUsuario.comboContratoPorUsuarioSME(req.userData.idUsuario)) || [];
        const ids = contratos.map(c => c.id);
        return idContratoFiltro && ids.includes(idContratoFiltro) ? [idContratoFiltro] : ids;
      })();

    const tabela = await dao.datatable(
      req.userData.idUsuario,
      origem === 'ps',
      idPrestadorServico || null,
      idUnidadeEscolar || null,
      datasList || null,
      idAmbienteUnidadeEscolar || null,
      idContratoList || null,
      idDiretoriaRegional || null,
      params.length,
      params.start
    );

    return ctrl.gerarRetornoDatatable(res, tabela);
  } catch (error) {
    console.log(error);
    return ctrl.gerarRetornoErro(res);
  }
}

async function tabelaDatasAgendamentoManual(req, res) {

  if (req.userData.origem.codigo !== 'ue') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const params = await utils.getDatatableParams(req);
  const idUnidadeEscolar = req.userData.idOrigemDetalhe;
  const tabela = await dao.datatableDatasAgendamentoManual(idUnidadeEscolar, params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);

}

async function inserir(req, res) {

  if (!['dre', 'ue'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  try {
    const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : req.body.unidadeEscolar?.id;
    const unidadeEscolar = await unidadeEscolarDao.buscarDetalhe(idUnidadeEscolar);
    const prestadorServico = await unidadeEscolarDao.buscarPrestadorServicoAtual(idUnidadeEscolar, req.body.data);
    const ambienteUnidadeEscolarList = (req.body.ambienteUnidadeEscolarList || []).filter(t => t.isSelected === true);
    const turnoList = (req.body.turnoList || []).filter(t => t.isSelected === true);

    if (turnoList.length === 0) {
      return await ctrl.gerarRetornoErro(res, 'Pelo menos um turno deve ser informado.');
    }

    if (ambienteUnidadeEscolarList.length === 0) {
      return await ctrl.gerarRetornoErro(res, 'Pelo menos um ambiente deve ser informado.');
    }

    for (ambienteUnidadeEscolar of ambienteUnidadeEscolarList) {
      for (turno of turnoList) {
        const idMonitoramento = await dao.inserir(prestadorServico.id, idUnidadeEscolar, ambienteUnidadeEscolar.id, 5, turno.id, req.body.descricao, req.body.data);
        await notificarAgendamentoManual(idMonitoramento, prestadorServico, unidadeEscolar);
      }
    }

    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

async function atualizar(req, res) {

  if (req.userData.origem.codigo != 'ue' || req.userData.cargo.id != UsuarioCargoConstants.RESPONSAVEL_UE) {
    return await ctrl.gerarRetornoErro(res);
  }

  if (req.params.id != req.body.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  try {
    await dao.atualizarData(req.params.id, req.body.novaData);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

async function remover(req, res) {

  if (req.userData.origem.codigo != 'ue' || req.userData.cargo.id != UsuarioCargoConstants.RESPONSAVEL_UE) {
    return await ctrl.gerarRetornoErro(res);
  }

  try {
    await dao.remover(req.params.id, req.userData.idUsuario);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

async function notificarAgendamentoManual(idMonitoramento, prestadorServico, unidadeEscolar) {

  const linkMonitoramento = process.env.FRONTEND_URL + '/monitoramento/detalhe/' + idMonitoramento;
  const emailUsuarioPrestadorServicoList = (await daoUsuario.buscarPrestadorPorUnidadeEscolar(unidadeEscolar.id)).map(u => u.email);
  const destinatario = prestadorServico.email + ',' + unidadeEscolar.diretoriaRegional.email + ',' + emailUsuarioPrestadorServicoList.join(',');

  ctrl.enviarEmail(destinatario, 'Nova Atividade', `
        Olá,
        <br><br>
        Uma nova atividade foi cadastrada no sistema de monitoramento de limpeza da SME/SP!
        <br>
        <br><b>UNIDADE ESCOLAR:</b> ${unidadeEscolar.codigo} | ${unidadeEscolar.descricao}
        <br><b>PRESTADOR DE SERVIÇO:</b> ${prestadorServico.razaoSocial}
        <br><br>
        Para visualizar os detalhes da atividade, <a href="${linkMonitoramento}" target="_blank">Clique aqui</a>.
        <br><br><br>
        E-mail enviado automaticamente, favor não responder.
    `);

}