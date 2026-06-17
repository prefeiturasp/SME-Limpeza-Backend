const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const fs = require('fs');
const path = require('path');

const Dao = require('./configuracao-dao');
const dao = new Dao();


exports.buscar = async (req, res) => {
  const configuracao = req.params.parametro ? await dao.buscar(req.params.parametro) : await dao.buscarTodos();
  await ctrl.gerarRetornoOk(res, configuracao);
}

exports.atualizar = async (req, res) => {

  if (req.userData.origem.codigo !== 'sme') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  if (req.params.parametro !== req.body.parametro) {
    return await ctrl.gerarRetornoErro(res, 'Houve um erro ao validar a requisição.');
  }

  if (req.body.parametro === 'TEXTO_NOTICIA') {
    await dao.atualizarDescricao(req.body.parametro, req.body.descricao);
    return await ctrl.gerarRetornoOk(res);
  }

  if (req.body.novoValor < 0) {
    return await ctrl.gerarRetornoErro(res, 'O valor não pode ser menor que zero.');
  }

  await dao.atualizarValor(req.body.parametro, req.body.novoValor);
  return await ctrl.gerarRetornoOk(res);

}

exports.buscaManutencaoSistema = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.buscaManutencaoSistema());
}

exports.salvaManutencaoSistema = async (req, res) => {
  if (req.userData.origem.codigo !== 'sme') {
    return await ctrl.gerarRetornoErro(res);
  }
  let retorno = await dao.salvaManutencaoSistema(req.body.manutencao);
  return await ctrl.gerarRetornoOk(res, retorno);
}

exports.buscarEmailSettings = async (req, res) => {
  try {
    const settings = await dao.buscarParametrosEmail();
    await ctrl.gerarRetornoOk(res, settings);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }
};

exports.atualizarEmailSettings = async (req, res) => {

  if (req.userData.origem.codigo !== 'sme') {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const settingsList = req.body; // Espera um array de { parametro: '...', valor: '...' }

  if (!Array.isArray(settingsList)) {
    return await ctrl.gerarRetornoErro(res, 'Formato de dados inválido. Esperado um array de configurações.');
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {
    for (const setting of settingsList) {
      if (setting.parametro && (setting.valor === '0' || setting.valor === '1')) {
        await dao.atualizarParametro(setting.parametro, setting.valor, _transaction);
      } else {
        console.warn(`Configuração inválida ignorada: ${JSON.stringify(setting)}`);
      }
    }
    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res, null, 'Configurações de e-mail atualizadas com sucesso.');
  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, 'Houve um erro ao atualizar as configurações de e-mail.');
  }
};

exports.buscaListaEmailsParaNotificacoes = async (req, res) => {
  const lista = await dao.buscarListaEmailsParaNotificacoes();
  return await ctrl.gerarRetornoOk(res, lista);
}

exports.salvarEmailsParaNotificacoes = async (req, res) => {
  const emails = req.body.emails;
  if(!emails){
    return await ctrl.gerarRetornoErro(res, 'Não houve emails para salvar');
  }
  await dao.salvarEmailsParaNotificacoes(emails);
  return await ctrl.gerarRetornoOk(res, null, 'Lista de e-mails atualizada com sucesso.');
}

exports.buscaListaEmailsParaNotificacoesPs = async (req, res) => {
  if (req.userData.origem.codigo !== 'ps') {
    return await ctrl.gerarRetornoErro(res, 'Apenas gestores de Prestadores de Serviço podem acessar esta funcionalidade.');
  }

  // idOrigemDetalhe contém o ID da Empresa (Prestador de Serviço) vinculado ao usuário
  const idPrestadorServico = req.userData.idOrigemDetalhe; 
  const fileName = `lista_emails_notificacoes_ps_${idPrestadorServico}.csv`;
  const filePath = path.join(__dirname, 'arquivos', 'lista-emails', fileName);

  if (!fs.existsSync(filePath)) {
    return await ctrl.gerarRetornoOk(res, { descricao: '' });
  }

  try {
    const config = await obterObjetoConfiguracaoPs(idPrestadorServico);
    return await ctrl.gerarRetornoOk(res, config);
  } catch (error) {
    console.error(`Erro ao ler arquivo de e-mails para PS ${idPrestadorServico}:`, error);
    return await ctrl.gerarRetornoErro(res, 'Erro ao ler a lista de e-mails do Prestador de Serviço.');
  }
}

/**
 * Retorna o objeto de configuração lido do CSV para um Prestador específico.
 * Método interno para ser usado por outros services (ex: envio de e-mail).
 */
async function obterObjetoConfiguracaoPs(idPrestadorServico) {
  const fileName = `lista_emails_notificacoes_ps_${idPrestadorServico}.csv`;
  const filePath = path.join(__dirname, 'arquivos', 'lista-emails', fileName);

  if (!fs.existsSync(filePath)) {
    return { ocorrenciaAtivo: false, ocorrenciaEmails: '', manualAtivo: false, manualEmails: '' };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  const configMap = {};
  lines.forEach(line => {
    const [key, ...values] = line.split(';');
    configMap[key] = values.join(';');
  });

  return {
    ocorrenciaAtivo: configMap['OcorrenciaAtivo'] === 'true',
    ocorrenciaEmails: configMap['OcorrenciaEmails'] || '',
    manualAtivo: configMap['ManualAtivo'] === 'true',
    manualEmails: configMap['ManualEmails'] || ''
  };
}

exports.obterObjetoConfiguracaoPs = obterObjetoConfiguracaoPs;

exports.salvarEmailsParaNotificacoesPs = async (req, res) => {
  if (req.userData.origem.codigo !== 'ps') {
    return await ctrl.gerarRetornoErro(res, 'Apenas gestores de Prestadores de Serviço podem salvar esta lista.');
  }

  const { ocorrenciaEmails, ocorrenciaAtivo, manualEmails, manualAtivo } = req.body;

  // Utilizamos o idOrigemDetalhe (ID da Empresa) para nomear o arquivo de forma única por prestador
  const idPrestadorServico = req.userData.idOrigemDetalhe;
  const dir = path.join(__dirname, 'arquivos', 'lista-emails');
  const fileName = `lista_emails_notificacoes_ps_${idPrestadorServico}.csv`;
  const filePath = path.join(dir, fileName);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    // Verifica se o processo Node.js possui permissão de escrita no diretório
    fs.accessSync(dir, fs.constants.W_OK);
  } catch (err) {
    console.error(`[PERMISSÃO] O diretório ${dir} não é gravável pelo Node.js:`, err);
    return await ctrl.gerarRetornoErro(res, 'O servidor não possui permissão de escrita na pasta de destino.');
  }

  try {
    // Validação de e-mails de Ocorrências
    const ocorrenciaEmailsArray = (ocorrenciaEmails || '').split(/[;\n]/).map(e => e.trim()).filter(e => e);
    for (const email of ocorrenciaEmailsArray) {
      if (!isValidEmail(email)) {
        return await ctrl.gerarRetornoErro(res, `E-mail inválido na lista de Ocorrências: "${email}"`);
      }
    }

    // Validação de e-mails de Agendamento Manual
    const manualEmailsArray = (manualEmails || '').split(/[;\n]/).map(e => e.trim()).filter(e => e);
    for (const email of manualEmailsArray) {
      if (!isValidEmail(email)) {
        return await ctrl.gerarRetornoErro(res, `E-mail inválido na lista de Agendamento Manual: "${email}"`);
      }
    }

    const cleanOcorrencia = (ocorrenciaEmails || '').split(/[;\n]/).map(e => e.trim()).filter(e => e).join(';');
    const cleanManual = (manualEmails || '').split(/[;\n]/).map(e => e.trim()).filter(e => e).join(';');

    const csvContent = [
      `OcorrenciaAtivo;${ocorrenciaAtivo}`,
      `OcorrenciaEmails;${cleanOcorrencia}`,
      `ManualAtivo;${manualAtivo}`,
      `ManualEmails;${cleanManual}`
    ].join('\n');

    fs.writeFileSync(filePath, csvContent, 'utf8');
    return await ctrl.gerarRetornoOk(res, null, 'Lista de e-mails salva em arquivo CSV com sucesso.');
  } catch (error) {
    console.error(`Erro ao salvar o arquivo CSV para PS ${idPrestadorServico}:`, error);
    return await ctrl.gerarRetornoErro(res, 'Erro ao salvar o arquivo CSV.');
  }
}

/**
 * Função para validar o formato de um e-mail usando Regex.
 */
function isValidEmail(email) {
  const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return emailRegex.test(String(email).toLowerCase());
}

module.exports = exports;