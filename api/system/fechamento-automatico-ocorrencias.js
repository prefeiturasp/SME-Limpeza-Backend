const conn = require('rfr')('core/database');
const emailService = require('rfr')('core/email');
const path = require('path');
const moment = require('moment');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');

let reqRes;
let emailData = '';

function printToConsole(message, addToEmail = true) {
  const dataHora = moment().format('DD/MM/YYYY HH:mm:ss');
  if (addToEmail) emailData += `\n<b>| ${dataHora} |</b>\t ${message}`;
  reqRes.write(`\n<b>| ${dataHora} |</b>\t ${message}`);
}

// UTIL: carregar feriados do CSV como Set de 'YYYY-MM-DD'
function carregarFeriadosCSVComoSet() {
  try {
    const filePath = path.resolve(__dirname, 'utils', 'feriadosFechamentoAutomatico.csv');
    const feriadosSet = new Set();

    if (!fs.existsSync(filePath)) {
      printToConsole(`Arquivo CSV não encontrado no caminho: ${filePath}`);
      return feriadosSet;
    }

    const conteudo = fs.readFileSync(filePath, 'utf8');
    const linhas = conteudo.split('\n').map(l => l.trim()).filter(Boolean);
    const dados = linhas.filter(l => !l.toLowerCase().startsWith('data'));

    for (const linha of dados) {
      const [dataBr] = linha.split(';');
      const ymd = moment(dataBr, 'DD-MM-YYYY', true).format('YYYY-MM-DD');
      if (ymd && ymd !== 'Invalid date') {
        feriadosSet.add(ymd);
      }
    }

    return feriadosSet;
  } catch (err) {
    printToConsole(`Erro ao carregar CSV de feriados: ${err.message}`);
    return new Set();
  }
}

// Subtrai N dias úteis inteiros de uma data, mantendo hora/min/seg
function subtrairDiasUteis(dataInicial, diasInteiros, feriadosSet) {
  if (!Number.isFinite(diasInteiros) || diasInteiros <= 0) {
    return moment(dataInicial).toDate();
  }
  let data = moment(dataInicial);
  let restantes = Math.floor(diasInteiros);

  while (restantes > 0) {
    data = data.subtract(1, 'day');
    const isFimDeSemana = [6, 7].includes(data.isoWeekday()); // 6=sab, 7=dom
    const isFeriado = feriadosSet.has(data.format('YYYY-MM-DD'));
    if (!isFimDeSemana && !isFeriado) {
      restantes--;
    }
  }

  return data.toDate();
}

async function obterDiasEncerramentoOcorrencia(transaction) {
  const sqlCfg = `
    select valor
    from configuracao
    where parametro = 'DIAS_ENCERRAMENTO_OCORRENCIA'
    limit 1
  `;
  const [row] = await conn.findAll(sqlCfg, [], transaction);
  const dias = row ? Number(row.valor) : NaN;

  // fallback seguro: 2 dias (padrão)
  return Number.isFinite(dias) && dias > 0 ? dias : 2;
}

module.exports = async (req, res) => {
  reqRes = res;
  res.write('<pre>');

  const transaction = await conn.iniciarTransaction();
  try {
    const diasEncerramento = await obterDiasEncerramentoOcorrencia(transaction);
    const diasUteis = Math.floor(diasEncerramento);
    const feriadosSet = carregarFeriadosCSVComoSet();
    const limite = subtrairDiasUteis(new Date(), diasUteis, feriadosSet);

    printToConsole(
      `Iniciando processamento - Encerrar ocorrencias abertas ha > ${diasUteis} dia(s) úteis (limite: ${moment(limite).format('DD/MM/YYYY HH:mm')})`,
      false
    );

    const sqlCount = `
      select count(*)::int as total
      from ocorrencia o
      where o.data_hora_final is null
        and o.data_hora_remocao is null
        and o.data_hora_cadastro <= $1::timestamp
    `;
    const [rowCount] = await conn.findAll(sqlCount, [limite], transaction);
    printToConsole(`Ocorrencias elegiveis: ${rowCount?.total || 0}`);

    const sqlUpdate = `
      update ocorrencia o
      set
        data_hora_final = now(),
        observacao_final = coalesce(o.observacao_final, '')
          || case when coalesce(o.observacao_final, '') = '' then '' else E'\\n' end
          || '[Encerrado automaticamente após ' || $2::int || ' dia(s) úteis em ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || ']',
        flag_encerramento_automatico = true
      where o.id_ocorrencia in (
        select id_ocorrencia
        from ocorrencia
        where data_hora_final is null
          and data_hora_remocao is null
          and coalesce(flag_encerramento_automatico, false) = false
          and data_hora_cadastro <= $1::timestamp
        order by data_hora_cadastro asc
      )
      returning
        o.id_ocorrencia as "idOcorrencia",
        o.data_hora_cadastro as "dataHoraCadastro";
    `;

    const encerradas = await conn.findAll(sqlUpdate, [limite, diasUteis], transaction);

    printToConsole(`Ocorrencias encerradas automaticamente: ${encerradas.length}`);

    const LOG_DIR = path.join(process.cwd(), 'logs');
    const agora = moment().format('YYYYMMDD_HHmmss');
    const nomeArquivo = `ocorrencias_encerradas_${agora}.csv`;

    if (encerradas.length > 0) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      const cabecalho = 'ID Ocorrência,Data/Hora Abertura';
      const linhas = encerradas.map(o =>
        `${o.idOcorrencia},${moment(o.dataHoraCadastro).format('DD/MM/YYYY HH:mm')}`
      );
      const conteudoCSV = [cabecalho, ...linhas].join('\n');
      const caminhoArquivo = path.join(LOG_DIR, nomeArquivo);
      fs.writeFileSync(caminhoArquivo, conteudoCSV, 'utf8');
      printToConsole(`Arquivo ${caminhoArquivo} gerado.`);
    } else {
      printToConsole('Nenhuma ocorrência para gerar arquivo.');
    }

    await conn.finalizarTransaction(true, transaction);
    printToConsole('Processo concluido com sucesso', false);
    res.write('</pre>');
    res.end();

  } catch (err) {
    console.error(err);
    await conn.finalizarTransaction(false, transaction);
    printToConsole('ERRO: Transaction Rollback');
    printToConsole(`ERRO: ${err?.message || err}`);
    await enviarEmailErro();
    res.write('</pre>');
    res.end();
  }
};

async function enviarEmailErro() {
  const assunto = 'ERRO | Cron - Encerrar ocorrencias automaticamente por prazo';
  const html = `
    <br>
    <pre>${emailData}</pre>
    <br><br>
    <br>E-mail enviado automaticamente, favor não responder.
    <br>Sistema de Limpeza | SME-SP<br>`;
  return emailService.enviar(process.env.EMAIL_NOTIFICATION, assunto, html);
}

// Exporta internals para testes unitários
if (!module.exports._test) {
  module.exports._test = {};
}
module.exports._test.subtrairDiasUteis = subtrairDiasUteis;
module.exports._test.carregarFeriadosCSVComoSet = carregarFeriadosCSVComoSet;
module.exports._test.obterDiasEncerramentoOcorrencia = obterDiasEncerramentoOcorrencia;
