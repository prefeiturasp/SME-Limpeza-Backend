const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const csv = require('rfr')('core/utils/csv.js');
const moment = require('moment');

const UsuarioCargoConstants = require('rfr')('core/constants/usuario-cargo.constantes');
const Dao = require('./monitoramento-dao');
const UnidadeEscolarDao = require('../unidade-escolar/unidade-escolar-dao');
const DaoUsuario = require('../usuario/usuario/usuario-dao');

const configuracaoService = require('../configuracao/configuracao-service');

const dao = new Dao();
const unidadeEscolarDao = new UnidadeEscolarDao();
const daoUsuario = new DaoUsuario();

exports.buscar = buscar;
exports.tabela = tabela;
exports.tabelaDatasAgendamentoManual = tabelaDatasAgendamentoManual;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;
exports.comboUePorIdContratoList = comboUePorIdContratoList;
exports.comboUePorIdContrato = comboUePorIdContrato;
exports.comboPrestadorServicoPorIdContrato = comboPrestadorServicoPorIdContrato;
exports.comboContratoPorIdPrestadorServico = comboContratoPorIdPrestadorServico;
exports.comboUePorIdPrestadorServico = comboUePorIdPrestadorServico;
exports.comboContratoPorIdUe = comboContratoPorIdUe;
exports.comboContratoPorIdUeList = comboContratoPorIdUeList;
exports.comboPrestadorServicoPorIdUe = comboPrestadorServicoPorIdUe;
exports.verificaSeDataEferiado = verificaSeDataEferiado;
exports.exportarRelatorioAgendamentoManual = exportarRelatorioAgendamentoManual;


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

  try {
    const params = await utils.getDatatableParams(req);
    const origem = req.userData.origem.codigo;
    const filters = params.filters || {}; // Mantém como objeto vazio se for nulo
    const idContratoListFiltro = (filters.contrato && filters.contrato.length > 0) ? filters.contrato.map(c => c.id) : null;
    const idUnidadeEscolarListFiltro = (filters.unidadeEscolar && filters.unidadeEscolar.length > 0) ? filters.unidadeEscolar.map(ue => ue.id) : null;

    const idContratoList = origem !== 'sme'
      ? null
      : await (async () => {
        const contratos = (await daoUsuario.comboContratoPorUsuarioSME(req.userData.idUsuario)) || [];
        const ids = contratos.map(c => c.id);
        return idContratoListFiltro?.filter(id => ids.includes(id)) || ids;
      })();

    const daoParams = {
      idUnidadeEscolarList: origem === 'ue' ? [req.userData.idOrigemDetalhe] : idUnidadeEscolarListFiltro,
      idDiretoriaRegional: origem === 'dre' ? req.userData.idOrigemDetalhe : null,
      idPrestadorServico: origem === 'ps' ? req.userData.idOrigemDetalhe : null,
      idContratoList: idContratoList,
      length: params.length,
      start: params.start
    }

    const tabela = await dao.datatableDatasAgendamentoManual(daoParams);
    return ctrl.gerarRetornoDatatable(res, tabela); // A função já retorna o array paginado
  } catch (error) {
    console.log(error);
    return ctrl.gerarRetornoErro(res);
  }
}

async function inserir(req, res) {

  if (!['dre', 'ue'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  try {
    const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : req.body.unidadeEscolar?.id;
    const unidadeEscolar = await unidadeEscolarDao.buscarDetalhe(idUnidadeEscolar);
    const prestadorServico = await unidadeEscolarDao.buscarPrestadorServicoAtual(idUnidadeEscolar, req.body.data);

    if(!prestadorServico){
      return await ctrl.gerarRetornoOk(res, {resp: false, dataSelelecionada: req.body.data}, 'Você não pode realizar um agendamento, para uma data superior a data de encerramento do contrato.');
    }

    const ambienteUnidadeEscolarList = (req.body.ambienteUnidadeEscolarList || []).filter(t => t.isSelected === true);
    const turnoList = (req.body.turnoList || []).filter(t => t.isSelected === true);

    if (turnoList.length === 0) {
      return await ctrl.gerarRetornoErro(res, 'Pelo menos um turno deve ser informado.');
    }

    if (ambienteUnidadeEscolarList.length === 0) {
      return await ctrl.gerarRetornoErro(res, 'Pelo menos um ambiente deve ser informado.');
    }
    
    let arrIdsMonitoramento = [];
    
    for (ambienteUnidadeEscolar of ambienteUnidadeEscolarList) {
      for (turno of turnoList) {
        const idMonitoramento = await dao.inserir(prestadorServico.id, idUnidadeEscolar, ambienteUnidadeEscolar.id, 5, turno.id, req.body.descricao, req.body.data);
        arrIdsMonitoramento.push(idMonitoramento);
        await notificarAgendamentoManual(idMonitoramento, prestadorServico, unidadeEscolar);
        }
    }

    if(arrIdsMonitoramento.length > 0){
      //Veirifica Dias Excepcionais
      if(req.body.arrDiaExcepcional.verificacao){
        let quantidadeDiasUtilizados = 0;
        let verificaDiasExcepcionais = false;
        let idContratoUeDiaExcepcional = 0;
        let mensagem = 'Você atingiu o limite de dias excepcionais para o ano da data selecionada.';

        const ultimoDiaAnoSelecionado = moment(req.body.data).clone().endOf('year').format('YYYY-MM-DD');
        const contratoAtual = await dao.buscaContratoIdUeData(idUnidadeEscolar, req.body.data);
          
        if (typeof contratoAtual === 'object' && contratoAtual.limiteDiasExcepcionais > 0) {
          const diaExcepcional = await dao.buscaDiasExcepcionais(contratoAtual.idContrato, idUnidadeEscolar, req.body.data);
          if (diaExcepcional) {
              idContratoUeDiaExcepcional = diaExcepcional.id;
              quantidadeDiasUtilizados = diaExcepcional.quantidadeDiasUtilizados + 1;
              if (quantidadeDiasUtilizados > contratoAtual.limiteDiasExcepcionais) {
                verificaDiasExcepcionais = true;
              } else {
                const verificacao1 = await dao.comparaDataLimiteExcepcional(contratoAtual.idContrato, idUnidadeEscolar, ultimoDiaAnoSelecionado);
                if(verificacao1 && !verificacao1.status){
                  for(idMonitoramento of arrIdsMonitoramento){
                    await dao.deleta(idMonitoramento);
                  }
                  return await ctrl.gerarRetornoOk(res, {resp: false}, mensagem);
                } else {
                  await dao.atualizaDiasExcepcionais(idContratoUeDiaExcepcional, quantidadeDiasUtilizados);
                }
              }
            } else {
              const verificacao2 = await dao.comparaDataLimiteExcepcional(contratoAtual.idContrato, idUnidadeEscolar, ultimoDiaAnoSelecionado);
              if(verificacao2){
                if(!verificacao2.status){
                  for(idMonitoramento of arrIdsMonitoramento){
                    await dao.deleta(idMonitoramento);
                  }
                  return await ctrl.gerarRetornoOk(res, {resp: false}, mensagem);
                } else {
                  await dao.inserirDiasExcepcionais(contratoAtual.idContrato, idUnidadeEscolar, 1, ultimoDiaAnoSelecionado);
                }
              } else {
                await dao.inserirDiasExcepcionais(contratoAtual.idContrato, idUnidadeEscolar, 1, ultimoDiaAnoSelecionado);
              }
            }
          } 

          if(verificaDiasExcepcionais){
            await dao.desabilitaDiasExcepcionais(idContratoUeDiaExcepcional);
            for(idMonitoramento of arrIdsMonitoramento){
              await dao.deleta(idMonitoramento);
            }
            return await ctrl.gerarRetornoOk(res, {resp: false}, mensagem);
          }
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

  let notificacaoMonitoramentoPsAtiva = false;
  let emailsAdicionaisPs = '';

  const configEmailsPs = await configuracaoService.obterObjetoConfiguracaoPs(prestadorServico.id);
  if(configEmailsPs) {
    notificacaoMonitoramentoPsAtiva = configEmailsPs.manualAtivo;
    emailsAdicionaisPs = configEmailsPs.manualEmails;
  }

  const verificacaoEmailMonitoramento = await ctrl.verificarEmailAtivo('EMAIL_NOTIFICACAO_AGENDAMENTO_MANUAL');
  if (verificacaoEmailMonitoramento.valor !== 1) {
    return;
  }

  const linkMonitoramento = process.env.FRONTEND_URL + '/monitoramento/detalhe/' + idMonitoramento;
  const emailUsuarioPrestadorServicoList = (await daoUsuario.buscarPrestadorPorUnidadeEscolar(unidadeEscolar.id)).map(u => u.email);

  let destinatario = '';
  if (notificacaoMonitoramentoPsAtiva && emailsAdicionaisPs.length > 4) {
    destinatario = emailsAdicionaisPs.split(';').map(item => item.trim()).filter(item => item !== "").join(',');
  } else {
    destinatario = prestadorServico.email + ',' + unidadeEscolar.diretoriaRegional.email + ',' + emailUsuarioPrestadorServicoList.join(',');
  }
  
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

async function comboUePorIdContrato(req, res) {
  return await ctrl.gerarRetornoOk(res, await dao.comboUePorIdContrato(req.body.idContrato));
}

async function comboUePorIdContratoList(req, res) {
  return await ctrl.gerarRetornoOk(res, await dao.comboUePorIdContratoList(req.body.idsContratoList));
}

async function comboPrestadorServicoPorIdContrato(req, res) {
  return await ctrl.gerarRetornoOk(res, await dao.comboPrestadorServicoPorIdContrato(req.body.idContrato));
}

async function comboContratoPorIdPrestadorServico(req, res) {
  return await ctrl.gerarRetornoOk(res, await dao.comboContratoPorIdPrestadorServico(req.body.idPrestadorServico));
} 

async function comboUePorIdPrestadorServico(req, res) {
  return await ctrl.gerarRetornoOk(res, await dao.comboUePorIdPrestadorServico(req.body.idPrestadorServico));
} 

async function comboContratoPorIdUe(req, res) {
  return await ctrl.gerarRetornoOk(res, await dao.comboContratoPorIdUe(req.body.idUe));
} 

async function comboContratoPorIdUeList(req, res) {
  return await ctrl.gerarRetornoOk(res, await dao.comboContratoPorIdUeList(req.body.idUeList));
}

async function comboContratoPorIdUeList(req, res) {
  return await ctrl.gerarRetornoOk(res, await dao.comboContratoPorIdUeList(req.body.idUeList));
}

async function comboPrestadorServicoPorIdUe(req, res) {
  return await ctrl.gerarRetornoOk(res, await dao.comboPrestadorServicoPorIdUe(req.body.idUe));
}

async function verificaSeDataEferiado(req, res) {
  if (!req.body.idUnidadeEscolar || !req.body.data) {
    return await ctrl.gerarRetornoErro(res, 'ID da Unidade Escolar e data são obrigatórios.');
  }
  const feriado = await dao.buscaFeriadoUEPorData(req.body.data, req.body.idUnidadeEscolar);
  return await ctrl.gerarRetornoOk(res, feriado );
}

async function exportarRelatorioAgendamentoManual(req, res) {
  try {
    const origem = req.userData.origem.codigo;
    const filters = req.body || {};
    const idContratoListFiltro = (filters.contrato && filters.contrato.length > 0) ? filters.contrato.map(c => c.id) : null;
    const idUnidadeEscolarListFiltro = (filters.unidadeEscolar && filters.unidadeEscolar.length > 0) ? filters.unidadeEscolar.map(ue => ue.id) : null;

    const idContratoList = origem !== 'sme'
      ? null
      : await (async () => {
        const contratos = (await daoUsuario.comboContratoPorUsuarioSME(req.userData.idUsuario)) || [];
        const ids = contratos.map(c => c.id);
        return idContratoListFiltro?.filter(id => ids.includes(id)) || ids;
      })();

    const daoParams = {
      idUnidadeEscolarList: origem === 'ue' ? [req.userData.idOrigemDetalhe] : idUnidadeEscolarListFiltro,
      idDiretoriaRegional: origem === 'dre' ? req.userData.idOrigemDetalhe : null,
      idPrestadorServico: origem === 'ps' ? req.userData.idOrigemDetalhe : null,
      idContratoList: idContratoList,
      length: null, // Sem limite para exportação
      start: 0
    };

    const dados = await dao.datatableDatasAgendamentoManual(daoParams);
    let dadosCSV = [];
    dados.data.forEach(item => {
      const itemCSV = {};
      itemCSV['Diretoria Regional'] = item.contrato.contratoDescricao;
      itemCSV['Contrato'] = item.contrato.contratoCodigo;
      itemCSV['Unidade Escolar'] = item.unidadeEscolar.descricao;
      itemCSV['Data'] = moment(item.data).format('DD/MM/YYYY');
      dadosCSV.push(itemCSV);
    });

    const csvResult = await csv.converterFromJson(dadosCSV);

    return await ctrl.gerarRetornoCSV(res, csvResult, 'relatorio-agendamento-manual');
  } catch (error) {
    console.log(error);
    return ctrl.gerarRetornoErro(res);
  }
}
