const conn = require('rfr')('core/database');
const emailService = require('rfr')('core/email');
const path = require('path');
const moment = require('moment');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const serviceModelo1 = require('./gerar-relatorio-gerencial-modelo1');
const serviceModelo2 = require('./gerar-relatorio-gerencial-modelo2');

let request;
let emailData = '';

function printToConsole(message, addToEmail = true) {
  const dataHora = moment().format('DD/MM/YYYY HH:mm:ss');
  if (addToEmail) emailData = emailData + `\n<b>| ${dataHora} |</b>\t ${message}`;
  request.write(`\n<b>| ${dataHora} |</b>\t ${message}`);
}

module.exports = async (req, res) => {

  request = res;

  res.write('<pre>');
  printToConsole('Iniciando processamento - SME Limpeza - Relatório Gerencial', false);

  const mesAno = moment().subtract(1, 'months').startOf('month');
  const dataInicial = moment(mesAno).startOf('month').format('YYYY-MM-DD');
  const dataFinal = moment(mesAno).endOf('month').format('YYYY-MM-DD');

  const unidadeEscolarList = await buscarUnidadesEscolares(dataInicial, dataFinal);

  for (const unidadeEscolar of unidadeEscolarList) {
    await gerarRelatorioPorUnidadeEscolar(unidadeEscolar);
  }

  printToConsole('Finalizando processamento - SME Limpeza - Relatório Gerencial', false);
  res.write('</pre>');
  res.end();

};

async function gerarRelatorioPorUnidadeEscolar(unidadeEscolar) {

  const _transaction = await conn.iniciarTransaction();

  const MES_ANO_COMPETENCIA = moment().subtract(1, 'months').startOf('month');

  try {

    emailData = '';

    await printToConsole(`############################################################################`);
    await printToConsole(`UNIDADE ESCOLAR: (${unidadeEscolar.idUnidadeEscolar}) ${unidadeEscolar.descricao}`);
    await printToConsole(`PRESTADOR DE SERVIÇO: (${unidadeEscolar.idPrestadorServico}) ${unidadeEscolar.prestadorServico.razaoSocial}`);
    await printToConsole(`CONTRATO: (${unidadeEscolar.idContrato}) (M${unidadeEscolar.contratoModelo}) ${moment(unidadeEscolar.dataInicial).format('DD/MM/YYYY')} - ${moment(unidadeEscolar.dataFinal).format('DD/MM/YYYY')}`);

    const dataInicial = moment.max(moment(MES_ANO_COMPETENCIA).startOf('month'), moment(unidadeEscolar.dataInicial));
    const dataFinal = moment.min(moment(MES_ANO_COMPETENCIA).endOf('month'), moment(unidadeEscolar.dataFinal));
    const ehMesCompleto = moment(MES_ANO_COMPETENCIA).startOf('month').isSame(dataInicial, 'day') && moment(MES_ANO_COMPETENCIA).endOf('month').isSame(dataFinal, 'day');
    const diasTrabalhados = ehMesCompleto ? 30 : parseInt(moment.duration(dataFinal.diff(dataInicial)).asDays());

    const valorMensal = await calcularValor(unidadeEscolar.idContrato, unidadeEscolar.valor);
    const valorDia = valorMensal / 30;
    const valorTotal = ehMesCompleto ? valorMensal : (valorDia * Math.abs(diasTrabalhados));

    await printToConsole(`COMPETÊNCIA: (${MES_ANO_COMPETENCIA.format('MM/YYYY')}) ${dataInicial.format('DD/MM/YYYY')} - ${dataFinal.format('DD/MM/YYYY')}`);
    await printToConsole(`VALOR MENSAL: R$ ${parseFloat(valorMensal).toFixed(2)}`);
    await printToConsole(`VALOR DIÁRIO: R$ ${parseFloat(valorDia).toFixed(2)}`);
    await printToConsole(`DIAS TRABALHADOS: ${diasTrabalhados} (R$ ${parseFloat(valorTotal).toFixed(2)})`);

    switch (unidadeEscolar.contratoModelo) {
      case 1: await serviceModelo1._gerar(_transaction, unidadeEscolar, dataInicial, dataFinal, valorTotal);
        break;
      case 2: await serviceModelo2._gerar(_transaction, unidadeEscolar, dataInicial, dataFinal, valorTotal);
        break;
      default: throw new Error('Modelo de contrato não implementado.');
    }

    await printToConsole(`############################################################################`);
    await conn.finalizarTransaction(true, _transaction);
    return true;

  } catch (error) {
    console.log(error);
    await conn.finalizarTransaction(false, _transaction);
    await printToConsole(`ERRO: Transaction Rollback`);
    await printToConsole(`ERRO: ${error}`);
    await enviarEmail(unidadeEscolar);
    return false;
  }

}

async function calcularValor(idContrato, valor) {

  const data = moment().format('YYYY-MM-DD');

  valor = parseFloat(valor);

  const reajustes = await buscarReajustesContrato(idContrato, data);

  for (const v of reajustes) {
    valor += (valor * (parseFloat(v.percentual) / 100));
  }

  return valor;

}

async function buscarUnidadesEscolares(dataInicial, dataFinal) {

  const sql = `
    select 
      ue.id_unidade_escolar, 
      ue.descricao, 
      ps.id_prestador_servico,
      c.id_contrato,
      cue.valor,
      cue.data_inicial,
      cue.data_final,
      c.modelo as contrato_modelo,
      json_build_object('id_prestador_servico', ps.id_prestador_servico, 'razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
    from contrato_unidade_escolar cue
    join unidade_escolar ue on ue.id_unidade_escolar = cue.id_unidade_escolar 
    join contrato c on c.id_contrato = cue.id_contrato
    join prestador_servico ps using (id_prestador_servico)
    where ($1::date between cue.data_inicial and cue.data_final) or ($2::date between cue.data_inicial and cue.data_final)
    order by ue.descricao`;

  return await conn.findAll(sql, [dataInicial, dataFinal]);

}

async function buscarReajustesContrato(idContrato, data) {

  const sql = `
    select * from contrato_reajuste
    where flag_ativo
      and id_contrato = $1
      and data_inicial <= $2::date
    order by data_inicial`;

  return await conn.findAll(sql, [idContrato, data]);

}

async function enviarEmail(unidadeEscolar) {

  const assunto = `ERRO | Relatório Gerencial - ${unidadeEscolar.descricao}`;

  const html = `
    <br>
    <pre>${emailData}</pre>
    <br><br>
    <br>E-mail enviado automaticamente, favor não responder.
    <br>Sistema de Limpeza | SME-SP<br>`;

  return await emailService.enviar(process.env.EMAIL_NOTIFICATION, assunto, html);

}