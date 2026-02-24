const conn = require('rfr')('core/database');
const emailService = require('rfr')('core/email');
const path = require('path');
const moment = require('moment');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let request;
let emailData = '';

const PERIODICIDADE_DIARIA = 1;
const PERIODICIDADE_SEMANAL = 2;
const PERIODICIDADE_MENSAL = 3;
const PERIODICIDADE_TRIMESTRAL = 4;

const WEEK_DAY_SEXTA = 5;
const WEEK_DAY_SABADO = 6;
const WEEK_DAY_DOMINGO = 7;

module.exports = async (req, res) => {

  const { data, idContrato } = req.query;

  if (data && !moment(data, 'YYYY-MM-DD', true).isValid()) {
    return res.status(500).send(`A data informada não é válida. Deve estar no formato 'YYYY-MM-DD'.`);
  }

  if (idContrato) {
    const contrato = await buscarContrato(idContrato);
    if (!contrato) {
      return res.status(500).send(`O contrato informado não foi encontrado.`);
    }
  }

  const dataMoment = data ? moment(data, 'YYYY-MM-DD', true) : moment();
  const dataFormatada = dataMoment.format('YYYY-MM-DD');
  const diaSemana = dataMoment.isoWeekday();

  request = res;

  res.write('<pre>');
  logMessage('SME_LIMPEZA - INICIANDO PROCESSO DE AGENDAMENTO DOS MONITORAMENTOS', false);
  logMessage(`DATA: ${dataFormatada} - ISO_WEEK_DAY: ${diaSemana}`, false);

  const unidadeEscolarList = await buscarUnidadesEscolares(dataFormatada, idContrato);

  logMessage(`Encontradas ${unidadeEscolarList.length} unidades escolares.`, false);

  for (const ue of unidadeEscolarList) {
    ue.dataMoment = dataMoment;
    ue.dataFormatada = dataFormatada;
    ue.diaSemana = diaSemana;
    await processarUnidadeEscolar(ue);
  }

  logMessage('SME_LIMPEZA - FINALIZANDO PROCESSO DE AGENDAMENTO DOS MONITORAMENTOS', false);
  res.write('</pre>');
  res.end();

};

async function processarUnidadeEscolar(unidadeEscolar) {

  let _transaction = await iniciarProcessoUnidadeEscolar(unidadeEscolar);

  try {

    const ehFeriado = await verificarFeriado(unidadeEscolar);

    if (!ehFeriado) {
      const planoTrabalhoList = await buscarAgendamentos(_transaction, unidadeEscolar);
      await processarAgendamentos(_transaction, unidadeEscolar, planoTrabalhoList);
    }

    await conn.finalizarTransaction(true, _transaction);

  } catch (error) {
    console.log(error);
    await conn.finalizarTransaction(false, _transaction);
    logMessage(`ERRO: Transaction Rollback`);
    logMessage(`ERRO: ${error}`);
    await enviarEmail(unidadeEscolar);
  }

}

async function iniciarProcessoUnidadeEscolar(unidadeEscolar) {

  emailData = '';
  let _transaction = await conn.iniciarTransaction();

  logMessage(`############################################################################`);
  logMessage(`UE: (${unidadeEscolar.idUnidadeEscolar}) ${unidadeEscolar.codigo} - ${unidadeEscolar.descricao}`);
  logMessage(`PS: (${unidadeEscolar.prestadorServico.idPrestadorServico}) ${unidadeEscolar.prestadorServico.razaoSocial}`);
  logMessage(`DATA: ${unidadeEscolar.dataFormatada}`);
  return _transaction;

}

async function verificarFeriado(unidadeEscolar) {

  const feriado = await buscarFeriado(unidadeEscolar.idUnidadeEscolar, unidadeEscolar.dataFormatada);

  if (!feriado) {
    return false;
  }

  logMessage(`FERIADO: ${feriado.descricao}`);
  logMessage(`IGNORANDO AGENDAMENTOS - FERIADO`);
  return true;

}

async function buscarAgendamentos(_transaction, unidadeEscolar) {

  const [diarios, semanais, mensais, trimestrais] = await Promise.all([
    buscarAgendamentosDiarios(_transaction, unidadeEscolar),
    buscarAgendamentosSemanais(_transaction, unidadeEscolar),
    buscarAgendamentosMensais(_transaction, unidadeEscolar),
    buscarAgendamentosTrimestrais(_transaction, unidadeEscolar)
  ]);

  return [...diarios, ...semanais, ...mensais, ...trimestrais];

}

async function processarAgendamentos(_transaction, unidadeEscolar, planoTrabalhoList) {

  // const agendamentos = planoTrabalhoList.map(planoTrabalho =>
  //   agendarMonitoramento(_transaction, unidadeEscolar, planoTrabalho)
  // );

  // await Promise.all(agendamentos);

  if (planoTrabalhoList.length === 0) {
    return;
  }

  const SQL_INSERT_MONITORAMENTO = `
  INSERT INTO monitoramento (
    id_prestador_servico,
    id_unidade_escolar,
    id_ambiente_unidade_escolar,
    id_periodicidade,
    id_turno,
    id_plano_trabalho_unidade_escolar,
    data
  ) VALUES `;

  const values = [];
  const placeholders = planoTrabalhoList.map((planoTrabalho, index) => {
    const baseIndex = index * 7;
    values.push(
      unidadeEscolar.prestadorServico.idPrestadorServico,
      unidadeEscolar.idUnidadeEscolar,
      planoTrabalho.idAmbienteUnidadeEscolar,
      planoTrabalho.idPeriodicidade,
      planoTrabalho.idTurno,
      planoTrabalho.idPlanoTrabalhoUnidadeEscolar,
      planoTrabalho.data ?? unidadeEscolar.dataFormatada
    );
    return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`;
  }).join(', ');

  const query = SQL_INSERT_MONITORAMENTO + placeholders;

  try {
    await conn.query(query, values, _transaction);
  } catch (error) {
    throw error; // Re-throw the error after logging it
  }

}

async function buscarAgendamentosDiarios(_transaction, unidadeEscolar) {
  const ehFinalSemana = unidadeEscolar.diaSemana > WEEK_DAY_SEXTA;
  const planoTrabalhoList = await buscarPlanoTrabalho(unidadeEscolar.idUnidadeEscolar, PERIODICIDADE_DIARIA, null, ehFinalSemana);
  logMessage(`DIÁRIO: ${planoTrabalhoList.length} (FINAL_SEMANA: ${ehFinalSemana})`);
  return planoTrabalhoList;
}

async function buscarAgendamentosSemanais(_transaction, unidadeEscolar) {
  const planoTrabalhoList = await buscarPlanoTrabalho(unidadeEscolar.idUnidadeEscolar, PERIODICIDADE_SEMANAL, unidadeEscolar.diaSemana);
  logMessage(`SEMANAL: ${planoTrabalhoList.length}`);
  return planoTrabalhoList;
}

async function buscarAgendamentosMensais(_transaction, unidadeEscolar) {

  let planoTrabalhoList = [];
  const isPrimeiroDiaSemana = await verificarEhPrimeiroDiaSemanaMes(unidadeEscolar);

  if (isPrimeiroDiaSemana) {
    planoTrabalhoList = await buscarPlanoTrabalho(unidadeEscolar.idUnidadeEscolar, PERIODICIDADE_MENSAL, unidadeEscolar.diaSemana);
  }

  logMessage(`MENSAL: ${planoTrabalhoList.length} (PRIMEIRO_DIA: ${isPrimeiroDiaSemana})`);
  return planoTrabalhoList;

}

async function buscarAgendamentosTrimestrais(_transaction, unidadeEscolar) {

  const planoTrabalhoList = (await buscarPlanoTrabalho(unidadeEscolar.idUnidadeEscolar, PERIODICIDADE_TRIMESTRAL))
    .filter(pt => unidadeEscolar.dataMoment.isSameOrAfter(pt.dataInicial, 'days'))
    .filter(pt => (unidadeEscolar.dataMoment.diff(pt.dataInicial, 'days') % 90) === 0);

  const novaData = unidadeEscolar.diaSemana === WEEK_DAY_SABADO
    ? unidadeEscolar.dataMoment.add(2, 'days').format('YYYY-MM-DD')
    : unidadeEscolar.diaSemana === WEEK_DAY_DOMINGO
      ? unidadeEscolar.dataMoment.add(1, 'day').format('YYYY-MM-DD')
      : null;

  if (novaData) {
    planoTrabalhoList.forEach(pt => pt.data = novaData);
  }

  logMessage(`TRIMESTRAL: ${planoTrabalhoList.length} (NOVA_DATA: ${novaData ?? false})`);
  return planoTrabalhoList;

}

async function verificarEhPrimeiroDiaSemanaMes(unidadeEscolar) {

  let result = unidadeEscolar.dataMoment.clone().startOf('month');

  while (result.isoWeekday() !== unidadeEscolar.diaSemana) {
    result.add(1, 'day');

  }

  return unidadeEscolar.dataMoment.isSame(result, 'day');

}

async function buscarFeriado(idUnidadeEscolar, data) {

  const sql = `
    select * from feriado
    where data = $1::date and id_unidade_escolar = $2`;

  return await conn.findOne(sql, [data, idUnidadeEscolar]);

}

async function buscarContrato(idContrato) {

  const sql = `
    select * from contrato
    where id_contrato = $1`;

  return await conn.findOne(sql, [idContrato]);

}

async function buscarUnidadesEscolares(data, idContrato) {

  const sql = `
    select ue.id_unidade_escolar, ue.codigo, ue.descricao,
      json_build_object('id_contrato', c.id_contrato, 'descricao', c.descricao, 'codigo', c.codigo) as contrato,
      json_build_object('id_prestador_servico', ps.id_prestador_servico, 'razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
    from unidade_escolar ue
    join contrato_unidade_escolar cue on cue.id_unidade_escolar = ue.id_unidade_escolar 
    join contrato c on c.id_contrato = cue.id_contrato
    join prestador_servico ps using (id_prestador_servico)
    where ue.flag_ativo and $1::date >= cue.data_inicial and $1::date <= cue.data_final
      and ($2::int is null or cue.id_contrato = $2::int)
    order by ue.descricao`;

  return await conn.findAll(sql, [data, idContrato]);

}

async function buscarPlanoTrabalho(idUnidadeEscolar, idPeriodicidade, diaSemana, flagSomenteFinalSemana = false) {

  const sql = `
    select 
      id_plano_trabalho_unidade_escolar, 
      id_ambiente_unidade_escolar, 
      id_periodicidade,
      id_turno,
      data_inicial
    from plano_trabalho_unidade_escolar
    where flag_ativo 
        and id_unidade_escolar = $1 
        and id_periodicidade = $2
        and case when $3::int is null then true else dia_semana = $3::int end
        and case when $4::bool is true then flag_final_semana else true end`;

  return await conn.findAll(sql, [idUnidadeEscolar, idPeriodicidade, diaSemana, flagSomenteFinalSemana]);

}

async function agendarMonitoramento(_transaction, unidadeEscolar, planoTrabalho) {

  const sql = `
    insert into monitoramento (
      id_prestador_servico,
      id_unidade_escolar,
      id_ambiente_unidade_escolar,
      id_periodicidade,
      id_turno,
      id_plano_trabalho_unidade_escolar,
      data
    ) values ($1, $2, $3, $4, $5, $6, $7)`;

  await conn.query(sql, [
    unidadeEscolar.prestadorServico.idPrestadorServico,
    unidadeEscolar.idUnidadeEscolar,
    planoTrabalho.idAmbienteUnidadeEscolar,
    planoTrabalho.idPeriodicidade,
    planoTrabalho.idTurno,
    planoTrabalho.idPlanoTrabalhoUnidadeEscolar,
    planoTrabalho.data ?? unidadeEscolar.dataFormatada
  ], _transaction);

}

async function enviarEmail(unidadeEscolar) {

  const assunto = `ERRO | Agendamento Automático - ${unidadeEscolar.descricao}`;

  const html = `
    <br>
    <pre>${emailData}</pre>
    <br><br>
    <br>E-mail enviado automaticamente, favor não responder.
    <br>Sistema de Limpeza | SME-SP<br>`;

  return await emailService.enviar(process.env.EMAIL_NOTIFICATION, assunto, html);

}

function logMessage(message, addToEmail = true) {
  const dataHora = moment().format('DD/MM/YYYY HH:mm:ss');
  const formattedMessage = `\n| ${dataHora} |\t ${message}`;
  request.write(formattedMessage);
  if (addToEmail) {
    emailData += formattedMessage;
  }
}