const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const csv = require('rfr')('core/utils/csv.js');
const bcrypt = require('bcrypt');
const emailService = require('rfr')('core/email');
const configuracaoService = require('../../configuracao/configuracao-service');

const UsuarioCargoConstants = require('rfr')('core/constants/usuario-cargo.constantes');
const UsuarioOrigemConstants = require('rfr')('core/constants/usuario-origem.constantes');

const Dao = require('./usuario-dao');
const UsuarioStatusDao = require('../usuario-status/usuario-status-dao');
const UnidadeEscolarDao = require('../../unidade-escolar/unidade-escolar-dao');
const DiretoriaRegionalDao = require('../../diretoria-regional/diretoria-regional-dao');

const dao = new Dao();
const usuarioStatusDao = new UsuarioStatusDao();
const unidadeEscolarDao = new UnidadeEscolarDao();
const diretoriaRegionalDao = new DiretoriaRegionalDao();
exports.buscar = buscar;
exports.tabela = tabela;
exports.exportar = exportar;
exports.importar = importar;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;
exports.menu = menu;
exports.alterarSenha = alterarSenha;
exports.verificaVinculoContrato = verificaVinculoContrato;

async function buscar(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const usuario = await dao.buscar(req.params.id);
  await ctrl.gerarRetornoOk(res, usuario);

}

async function verificaVinculoContrato(req, res) {
  const email = req.params.email;
  if (!email) {
    return await ctrl.gerarRetornoErro(res, 'E-mail não informado.');
  }
  const resultado = await dao.verificaVinculoContrato(email);
  await ctrl.gerarRetornoOk(res, resultado);
}

async function tabela(req, res) {

  if (!['sme', 'dre', 'ps'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const params = await utils.getDatatableParams(req);
  const contratosIds = params.filters.contrato ? params.filters.contrato.map(c => c.id) : null;
  const idContratoL = req.userData.origem.codigo !== 'sme' ? null : (await dao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const idOrigemDetalheList = params.filters.idOrigemDetalhe?.id ? [params.filters.idOrigemDetalhe.id] : await buscarOrigemDetalheListagem(req.userData);
  const idUsuarioOrigemList = params.filters.idUsuarioOrigem ? [params.filters.idUsuarioOrigem] : await buscarUsuarioOrigemListagem(req.userData);
  let listaIdsContrato = [];

  if(contratosIds !== null && contratosIds.length > 0) {
    listaIdsContrato = contratosIds
  } else {
    listaIdsContrato = idContratoL
  }
  
  const idUsuarioStatus = params.filters.idUsuarioStatus;
  const idUsuarioStatusList = idUsuarioStatus === undefined ? [1] : (idUsuarioStatus ? [idUsuarioStatus] : null);
  const tabela = await dao.datatable(params.filters.nome, params.filters.email, params.filters.idUsuarioCargo, idOrigemDetalheList, idUsuarioOrigemList, listaIdsContrato, params.length, params.start, idUsuarioStatusList, params.filters.dreContrato);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

async function exportar(req, res) {
  try {

    if (!['sme', 'dre', 'ps'].includes(req.userData.origem.codigo)) {
      return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
    }

    const params = await utils.getDatatableParams(req);
    const idsContrato = params.filters.contrato ? params.filters.contrato.map(c => c.id) : null;
    const idContratoList = req.userData.origem.codigo !== 'sme' ? null : (await dao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
    const idOrigemDetalheList = params.filters.idOrigemDetalhe?.id ? [params.filters.idOrigemDetalhe.id] : await buscarOrigemDetalheListagem(req.userData);
    const idUsuarioOrigemList = params.filters.idUsuarioOrigem ? [params.filters.idUsuarioOrigem] : await buscarUsuarioOrigemListagem(req.userData);
    let idsContratosList = [];
  
    if(idsContrato !== null && idsContrato.length > 0) {
      idsContratosList = idsContrato
    } else {
      idsContratosList = idContratoList
    }
    
    const idUsuarioStatus = params.filters.idUsuarioStatus;
    const idUsuarioStatusList = idUsuarioStatus === undefined ? [1] : (idUsuarioStatus ? [idUsuarioStatus] : null);

    const dados = await dao.exportar(
      params.filters.nome, 
      params.filters.email, 
      params.filters.idUsuarioCargo, 
      idOrigemDetalheList, 
      idUsuarioOrigemList, 
      idsContratosList, 
      idUsuarioStatusList, 
      params.filters.dreContrato);
    const csvConteudo = await csv.converterFromJson(dados);

    const arquivo = {
      name: `usuarios_${new Date().getTime()}`,
      buffer: Buffer.from(csvConteudo),
      extension: 'csv'
    };

    return await ctrl.gerarRetornoOk(res, arquivo);
  } catch (err) {
    return await ctrl.gerarRetornoErro(res, err);
  }
}

async function importar(req, res) {

  if (!['sme', 'dre', 'ps'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const isConfirmar = req.body.confirmar === 'true' || req.body.confirmar === true;
  const _transaction = await ctrl.iniciarTransaction();

  try {
    let usuarioList;
    if (req.file) {
      usuarioList = await csv.converterFromCsv(req.file);
      // Atribui o número da linha física do CSV (Data começa na linha 2)
      usuarioList.forEach((u, i) => {
        u.linha = i + 2;
      });
    } else {
      usuarioList = typeof req.body.usuarios === 'string' ? JSON.parse(req.body.usuarios) : req.body.usuarios;
    }

    if (!usuarioList || !usuarioList.length) {
      await ctrl.finalizarTransaction(false, _transaction);
      return await ctrl.gerarRetornoErro(res, 'Nenhum dado encontrado para processar.');
    }

    if (req.file && (!usuarioList[0].nome || !usuarioList[0].email || !usuarioList[0].id_origem)) {
      await ctrl.finalizarTransaction(false, _transaction);
      return await ctrl.gerarRetornoErro(res, `A estrutura do arquivo é inválida.`);
    }

    for (const usuario of usuarioList) {

      if (!usuario.nome || !usuario.email) {
        usuario.classeResultado = 'danger';
        usuario.mensagemResultado = `${!usuario.nome ? 'Nome' : 'E-mail'} ausente.`;
        continue;
      }
      usuario.idOrigem = parseInt(usuario.id_origem);
      if (![
        UsuarioOrigemConstants.SME,
        UsuarioOrigemConstants.DRE,
        UsuarioOrigemConstants.UE
      ].includes(usuario.idOrigem)) {
        usuario.classeResultado = 'danger';
        usuario.mensagemResultado = `Origem inválida.`;
        continue;
      }

      if (usuario.idOrigem === UsuarioOrigemConstants.SME) {
        usuario.idUsuarioCargo = UsuarioCargoConstants.GESTOR_SME;
      }

      if (usuario.idOrigem === UsuarioOrigemConstants.DRE) {

        const diretoriaRegional = await diretoriaRegionalDao.buscarPorDescricaoAndAtivo(usuario.origem_chave);
        if (diretoriaRegional) {
          usuario.idOrigemDetalhe = diretoriaRegional.id;
        } else {
          usuario.classeResultado = 'danger';
          usuario.mensagemResultado = `DRE inválida.`;
          continue;
        }
        usuario.idUsuarioCargo = UsuarioCargoConstants.GESTOR_DRE;
      }
      if (usuario.idOrigem === UsuarioOrigemConstants.UE) {
        const unidadeEscolar = await unidadeEscolarDao.buscarPorCodigo(usuario.origem_chave);
        if (unidadeEscolar) {
          usuario.idOrigemDetalhe = unidadeEscolar.id;
        } else {
          usuario.classeResultado = 'danger';
          usuario.mensagemResultado = `UE inválida.`;
          continue;
        }
        switch (usuario.cargo_ue) {
          case 'FT':
            usuario.idUsuarioCargo = UsuarioCargoConstants.FISCAL_TITULAR;
            break;
          case 'FS':
            usuario.idUsuarioCargo = UsuarioCargoConstants.FISCAL_SUPLENTE;
            break;
          case 'R':
            usuario.idUsuarioCargo = UsuarioCargoConstants.RESPONSAVEL_UE;
            break;
          default:
            usuario.classeResultado = 'danger';
            usuario.mensagemResultado = `Cargo inválido.`;
            continue;
        }
        if (['FT', 'FS'].includes(usuario.cargo_ue) && !usuario.url_nomeacao) {
          usuario.classeResultado = 'danger';
          usuario.mensagemResultado = `URL nomeação inválida.`;
          continue;
        }
      }

      const usuarioExistente = await dao.findDetalhadoByEmail(usuario.email, _transaction);

      if (usuarioExistente) {
        usuario.classeResultado = 'info';
        usuario.mensagemResultado = isConfirmar ? 'Atualizado com sucesso.' : 'O Usuário será atualizado.';

        if (isConfirmar) {
          await dao.atualizar(
            usuarioExistente.id,
            usuario.nome,
            usuarioExistente.email,
            usuarioExistente.senha,
            1, // Mantém ou Reativa o usuário como Ativo
            usuario.idUsuarioCargo,
            usuario.idOrigemDetalhe,
            usuario.url_nomeacao,
            _transaction
          );
        }

      } else {
        //VERIFICA SE O USUÁRIO ESTÁ VINCULADO A UM CONTRATO ATIVO
        const vinculo = await dao.verificaVinculoContrato(usuario.email);
        if (vinculo.possuiVinculo) {
          usuario.classeResultado = 'danger';
          usuario.mensagemResultado = 'Usuário vinculado a um contrato ativo.';
          continue;
        }
        usuario.classeResultado = 'success';
        usuario.mensagemResultado = isConfirmar ? 'Cadastrado com sucesso.' : 'Usuário novo. Será cadastrado.';

        if (isConfirmar) {
          const hashSenhaAleatoria = bcrypt.hashSync(Math.random().toString(36).slice(-10), 10);
          await dao.insert(
            usuario.nome,
            usuario.email,
            hashSenhaAleatoria,
            1, // STATUS ATIVO
            usuario.idUsuarioCargo,
            usuario.idOrigemDetalhe,
            usuario.url_nomeacao,
            _transaction
          );
        }
      }
    }

    // Coleta e-mails válidos para o processo de sincronização
    const emailsValidos = usuarioList
      .filter(u => u.classeResultado !== 'danger')
      .map(u => u.email);

    // Se for confirmação, desativa quem não está na lista ANTES de checar cobertura
    if (isConfirmar) {
      await dao.desativarNaoListados(emailsValidos, _transaction);
    }

    // Validação de Cobertura Total
    const entidadesVazias = await dao.buscarEntidadesSemUsuarios();
    const pendentes = entidadesVazias.filter(entidade => {
      if (entidade.tipo === 'DRE') {
        return !usuarioList.some(u => u.id_origem == 2 && u.origem_chave === entidade.chave && u.classeResultado !== 'danger');
      }
      if (entidade.tipo === 'UE') {
        return !usuarioList.some(u => u.id_origem == 3 && u.origem_chave === entidade.chave && u.classeResultado !== 'danger');
      }
      // Para contratos, a lógica do CSV é indireta via UE. 
      // Se o CSV cobrir uma UE que pertence ao contrato, ele é considerado "atendido".
      return true; // Contratos são validados estritamente pelo estado final do banco
    });

    if (pendentes.length > 0) {
      await ctrl.finalizarTransaction(false, _transaction);

      let resumoHtml = '<table class="table table-bordered table-sm mt-2" style="background-color: white; color: black;">';
      resumoHtml += '<thead><tr><th>Tipo</th><th>Entidade</th></tr></thead><tbody>';
      pendentes.forEach(p => {
        resumoHtml += `<tr><td>${p.tipo}</td><td>${p.nome}</td></tr>`;
      });
      resumoHtml += '</tbody></table>';

      return await ctrl.gerarRetornoErro(res,
        `Importação bloqueada: Existem entidades ativas sem usuários.<br><br>` +
        `<b>Itens faltando:</b>${resumoHtml}<br>` +
        `Por favor, envie uma lista atualizada que contemple todos os registros ativos.`);
    }

    usuarioList.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    await ctrl.finalizarTransaction(isConfirmar, _transaction);
    await ctrl.gerarRetornoOk(res, usuarioList);

  } catch (error) {
    console.log(error)
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, typeof error === 'string' ? error : null);
  }

}

async function buscarOrigemDetalheListagem(userData) {

  let idOrigemDetalheList = [];

  if (userData.idOrigemDetalhe) {
    idOrigemDetalheList.push(userData.idOrigemDetalhe);
  }

  if (userData.origem.codigo === 'sme') {
    return null;
  }

  if (userData.origem.codigo === 'dre') {
    //Pode buscar usuários da DRE e das UE subordinadas.
    let unidadeEscolarList = await unidadeEscolarDao.comboTodosDiretoriaRegional(userData.idOrigemDetalhe);
    for (let ue of unidadeEscolarList) {
       if (ue.id) {
        idOrigemDetalheList.push(ue.id);
      }
    }
  }

  return idOrigemDetalheList.length > 0 ? idOrigemDetalheList : null;

}

async function buscarUsuarioOrigemListagem(userData) {

  if (['ue', 'ps'].includes(userData.origem.codigo)) {
    return [userData.origem.id];
  }

  if (userData.origem.codigo === 'dre') {
    //Pode buscar usuários da DRE e das UE subordinadas.
    return [2, 3];
  }

  if (userData.origem.codigo === 'sme') {
    return [1, 2, 3, 4];
  }

}

async function inserir(req, res) {

  if (!['sme', 'dre', 'ps'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const { nome, email, senha, idUsuarioStatus, idUsuarioOrigem, idOrigemDetalhe, urlNomeacao } = req.body;
  let unidadeEscolarList = req.body.unidadeEscolarList || [];
  let contratoList = req.body.contratoList || [];
  let idUsuarioCargo = req.body.idUsuarioCargo;

  const _transaction = await ctrl.iniciarTransaction();

  try {

    if (!nome || !email || !senha || !idUsuarioStatus || !idUsuarioOrigem) {
      return await ctrl.gerarRetornoErro(res);
    }

    if ([UsuarioOrigemConstants.UE, UsuarioOrigemConstants.PS].includes(idUsuarioOrigem) && !idUsuarioCargo) {
      return await ctrl.gerarRetornoErro(res);
    }

    if (idUsuarioOrigem != UsuarioOrigemConstants.SME && !idOrigemDetalhe) {
      return await ctrl.gerarRetornoErro(res);
    }

    switch (idUsuarioOrigem) {
      case UsuarioOrigemConstants.DRE:
        idUsuarioCargo = UsuarioCargoConstants.GESTOR_DRE;
        break;
      case UsuarioOrigemConstants.SME:
        idUsuarioCargo = UsuarioCargoConstants.GESTOR_SME;
        break;
    }

    if ([
      UsuarioCargoConstants.FISCAL_TITULAR,
      UsuarioCargoConstants.FISCAL_SUPLENTE
    ].includes(idUsuarioCargo) && !urlNomeacao) {
      return await ctrl.gerarRetornoErro(res, 'Informe o link de nomeação do fiscal.');
    }
    //VERIFICA SE O USUÁRIO ESTÁ VINCULADO A UM CONTRATO ATIVO
    const vinculo = await dao.verificaVinculoContrato(email);
    if (vinculo.possuiVinculo) {
      return await ctrl.gerarRetornoErro(res, 'Este usuário já está vinculado a um contrato ativo e não pode ser inserido.');
    }

    if (await dao.findDetalhadoByEmail(email)) {
      return await ctrl.gerarRetornoErro(res, 'Já existe usuário cadastrado para o email informado.');
    }

    const hashSenha = bcrypt.hashSync(senha, 10);
    const idUsuario = await dao.insert(nome, email, hashSenha, idUsuarioStatus, idUsuarioCargo, idOrigemDetalhe, urlNomeacao, _transaction);

    if (idUsuarioOrigem == UsuarioOrigemConstants.SME) {
      contratoList.map(async (c) => await dao.insertContratoUsuarioSME(idUsuario, c.id, _transaction));
    }

    if (idUsuarioOrigem == UsuarioOrigemConstants.PS) {
      if (idUsuarioCargo === UsuarioCargoConstants.GESTOR_PS) {
        unidadeEscolarList = await unidadeEscolarDao.comboTodosPorPrestadorServico(idOrigemDetalhe);
      }
      unidadeEscolarList.map(async (ue) => await dao.insertPrestadorUnidadeEscolar(idUsuario, ue.id, _transaction));
    }

    await enviarEmailNovoFiscal(req.userData, nome, email, idUsuarioCargo, idOrigemDetalhe, urlNomeacao);
    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, 'Houve um erro ao atualizar o usuário.');
  }


}

async function atualizar(req, res) {

  if (!['sme', 'dre', 'ps'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const { id, nome, email, senha, idUsuarioStatus, idUsuarioOrigem, idOrigemDetalhe, urlNomeacao } = req.body;
  let contratoList = req.body.contratoList || [];
  let unidadeEscolarList = req.body.unidadeEscolarList || [];
  let idUsuarioCargo = req.body.idUsuarioCargo;

  if (req.params.id != id || !nome || !email || !senha || !idUsuarioStatus || !idUsuarioOrigem) {
    return await ctrl.gerarRetornoErro(res);
  }

  if ([UsuarioOrigemConstants.UE, UsuarioOrigemConstants.PS].includes(idUsuarioOrigem) && !idUsuarioCargo) {
    return await ctrl.gerarRetornoErro(res);
  }

  if (idUsuarioOrigem != UsuarioOrigemConstants.SME && !idOrigemDetalhe) {
    return await ctrl.gerarRetornoErro(res);
  }

  switch (idUsuarioOrigem) {
    case UsuarioOrigemConstants.DRE:
      idUsuarioCargo = UsuarioCargoConstants.GESTOR_DRE;
      break;
    case UsuarioOrigemConstants.SME:
      idUsuarioCargo = UsuarioCargoConstants.GESTOR_SME;
      break;
  }

  if ([
    UsuarioCargoConstants.FISCAL_TITULAR,
    UsuarioCargoConstants.FISCAL_SUPLENTE
  ].includes(idUsuarioCargo) && !urlNomeacao) {
    return await ctrl.gerarRetornoErro(res, 'Informe o link de nomeação do fiscal.');
  }

  const usuarioAtual = await dao.findById(req.params.id);

  const usuarioExistenteEmail = await dao.findDetalhadoByEmail(email);
  if (usuarioExistenteEmail && id != usuarioAtual.idUsuario) {
    return await ctrl.gerarRetornoErro(res, 'Já existe usuário cadastrado para o email informado.');
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    await dao.removerPrestadorUnidadeEscolar(req.params.id, _transaction);
    await dao.removerContratoUsuarioSME(req.params.id, _transaction);

    const hashSenha = senha != usuarioAtual.senha ? bcrypt.hashSync(senha, 10) : senha;
    await dao.atualizar(req.params.id, nome, email, hashSenha, idUsuarioStatus, idUsuarioCargo, idOrigemDetalhe, urlNomeacao, _transaction);

    if (idUsuarioOrigem == UsuarioOrigemConstants.SME) {
      contratoList.map(async (c) => await dao.insertContratoUsuarioSME(req.params.id, c.id, _transaction));
    }

    if (idUsuarioOrigem == UsuarioOrigemConstants.PS) {
      if (idUsuarioCargo === UsuarioCargoConstants.GESTOR_PS) {
        unidadeEscolarList = await unidadeEscolarDao.comboTodosPorPrestadorServico(idOrigemDetalhe);
      }
      unidadeEscolarList.map(async (ue) => await dao.insertPrestadorUnidadeEscolar(req.params.id, ue.id, _transaction));
    }

    await enviarEmailAtualizacaoFiscal(req.userData, usuarioAtual.idUsuarioStatus, idUsuarioStatus, nome, email, idUsuarioCargo, idOrigemDetalhe, urlNomeacao);
    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, 'Houve um erro ao atualizar o usuário.');
  }

}

async function remover(req, res) {

  if (!['sme', 'dre', 'ps'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  await dao.desativar(req.params.id);
  await ctrl.gerarRetornoOk(res);

}

async function menu(req, res) {

  if (!req.userData.origem || !req.userData.cargo) {
    return await ctrl.gerarRetornoErro(res);
  }

  let menuList = [];

  switch (req.userData.cargo.id) {

    case UsuarioCargoConstants.GESTOR_SME:
      menuList = await montarMenuGestorSME();
      break;

    case UsuarioCargoConstants.GESTOR_DRE:
      menuList = await montarMenuGestorDRE();
      break;

    case UsuarioCargoConstants.RESPONSAVEL_UE:
      menuList = await montarMenuGestorUE();
      break;

    case UsuarioCargoConstants.FISCAL_TITULAR:
      menuList = await montarMenuFiscalUE();
      break;

    case UsuarioCargoConstants.FISCAL_SUPLENTE:
      menuList = await montarMenuFiscalUE();
      break;

    case UsuarioCargoConstants.GESTOR_PS:
      menuList = await montarMenuGestorPS();
      break;

  }

  await ctrl.gerarRetornoOk(res, menuList);

}

async function montarMenuGestorSME() {

  return [
    {
      nome: 'Painel Inicial',
      icone: 'icon-equalizer',
      link: 'painel-inicial'
    },
    {
      nome: 'Cadastros',
      icone: 'icon-layers',
      itemList: [
        { nome: 'Usuários', link: 'usuario' },
        { nome: 'DRE\'s', link: 'diretoria-regional' },
        { nome: 'Unidades Escolares', link: 'unidade-escolar' },
        { nome: 'Prestadores de Serviço', link: 'prestador-servico' },
        { nome: 'Cargos', link: 'cargo' },
        { nome: 'Contratos', link: 'contrato' },
        { nome: 'Ambientes Gerais', link: 'plano-trabalho/ambiente/ambiente-geral' },
        { nome: 'Ambientes UE\'s', link: 'plano-trabalho/ambiente/ambiente-unidade-escolar' },
        { nome: 'Configurações', link: 'configuracao' },
        { nome: 'Ocorrência Retroativa', link: 'ocorrencia/ocorrencia-retroativa' },
        { nome: 'Feriados Gerais', link: 'feriado-geral' }
      ]
    },
    {
      nome: 'Planos de Trabalho',
      icone: 'icon-briefcase',
      link: 'plano-trabalho/matriz'
    },
    {
      nome: 'Monitoramentos',
      icone: 'icon-notebook',
      link: 'monitoramento'
    },
    {
      nome: 'Ocorrências',
      icone: 'icon-shield',
      link: 'ocorrencia'
    },
    {
      nome: 'Relatórios',
      icone: 'icon-chart',
      itemList: [
        { nome: 'Boletim de Medição - UE', link: 'relatorio/gerencial' },
        { nome: 'Boletim de Medição - Contrato', link: 'relatorio/contrato' },
        { nome: 'Pontuação - Contrato', link: 'relatorio/contrato-pontos' },
        { nome: 'Equipe Alocada - UE', link: 'relatorio/equipe' },
        { nome: 'Equipe Alocada - Contrato', link: 'relatorio/equipe-contrato' },
        { nome: 'Agendamento Manual', link: 'relatorio/agendamento-manual' }
        // { nome: 'Ocorrências - Funcionários', link: 'relatorio/ocorrencia-funcionario' },
        // { nome: 'Declarações', link: 'declaracao' }
      ]
    },
  ];

}

async function montarMenuGestorDRE() {

  return [
    {
      nome: 'Painel Inicial',
      icone: 'icon-equalizer',
      link: 'painel-inicial'
    },
    {
      nome: 'Cadastros',
      icone: 'icon-layers',
      itemList: [
        { nome: 'Usuários', link: 'usuario' },
        { nome: 'Unidades Escolares', link: 'unidade-escolar' },
      ]
    },
    {
      nome: 'Monitoramentos',
      icone: 'icon-notebook',
      link: 'monitoramento'
    },
    {
      nome: 'Ocorrências',
      icone: 'icon-shield',
      link: 'ocorrencia'
    },
    {
      nome: 'Relatórios',
      icone: 'icon-chart',
      itemList: [
        { nome: 'Boletim de Medição - UE', link: 'relatorio/gerencial' },
        { nome: 'Boletim de Medição - Contrato', link: 'relatorio/contrato' },
        { nome: 'Pontuação - Contrato', link: 'relatorio/contrato-pontos' },
        { nome: 'Agendamento Manual', link: 'relatorio/agendamento-manual' }
        // { nome: 'Declarações', link: 'declaracao' }
      ]
    },
  ];

}

async function montarMenuGestorUE() {

  return [
    {
      nome: 'Painel Inicial',
      icone: 'icon-equalizer',
      link: 'painel-inicial'
    },
    {
      nome: 'Cadastros',
      icone: 'icon-layers',
      itemList: [
        { nome: 'Feriados', link: 'feriado' },
        { nome: 'Ambientes', link: 'plano-trabalho/ambiente/ambiente-unidade-escolar' }
      ]
    },
    {
      nome: 'Planos de Trabalho',
      icone: 'icon-briefcase',
      link: 'plano-trabalho/unidade-escolar'
    },
    {
      nome: 'Monitoramentos',
      icone: 'icon-notebook',
      link: 'monitoramento'
    },
    {
      nome: 'Ocorrências',
      icone: 'icon-shield',
      itemList: [
        { nome: 'Listagem', link: 'ocorrencia' },
        { nome: 'Mensagens', link: 'ocorrencia/mensagem' },
      ]
    },
    {
      nome: 'Relatórios',
      icone: 'icon-chart',
      itemList: [
        { nome: 'Boletim de Medição', link: 'relatorio/gerencial' },
        { nome: 'Agendamento Manual', link: 'relatorio/agendamento-manual' }
      ]
    },
  ];
}

async function montarMenuFiscalUE() {

  return [
    {
      nome: 'Painel Inicial',
      icone: 'icon-equalizer',
      link: 'painel-inicial'
    },
    {
      nome: 'Cadastros',
      icone: 'icon-layers',
      itemList: [
        { nome: 'Ambientes', link: 'plano-trabalho/ambiente/ambiente-unidade-escolar' }
      ]
    },
    {
      nome: 'Monitoramentos',
      icone: 'icon-notebook',
      link: 'monitoramento'
    },
    {
      nome: 'Ocorrências',
      icone: 'icon-shield',
      itemList: [
        { nome: 'Listagem', link: 'ocorrencia' },
        { nome: 'Mensagens', link: 'ocorrencia/mensagem' },
      ]
    },
    // {
    //   nome: 'Declarações',
    //   icone: 'icon-note',
    //   link: 'declaracao'
    // },
    {
      nome: 'Relatórios',
      icone: 'icon-chart',
      itemList: [
        { nome: 'Boletim de Medição', link: 'relatorio/gerencial' },
        { nome: 'Agendamento Manual', link: 'relatorio/agendamento-manual' }
      ]
    },
  ];
}

async function montarMenuGestorPS() {

  return [
    {
      nome: 'Painel Inicial',
      icone: 'icon-equalizer',
      link: 'painel-inicial'
    },
    {
      nome: 'Cadastros',
      icone: 'icon-layers',
      itemList: [
        { nome: 'Configurações', link: 'configuracao' }
      ]
    },
    {
      nome: 'Usuários',
      icone: 'icon-people',
      link: 'usuario'
    },

    {
      nome: 'Aplicativo',
      icone: 'icon-screen-smartphone',
      link: 'aplicativo'
    },
    {
      nome: 'Planos de Trabalho',
      icone: 'icon-briefcase',
      link: 'plano-trabalho/unidade-escolar'
    },
    {
      nome: 'Monitoramentos',
      icone: 'icon-notebook',
      link: 'monitoramento'
    },
    {
      nome: 'Ocorrências',
      icone: 'icon-shield',
      itemList: [
        { nome: 'Listagem', link: 'ocorrencia' },
        { nome: 'Mensagens', link: 'ocorrencia/mensagem' },
      ]
    },
    {
      nome: 'Relatórios',
      icone: 'icon-chart',
      itemList: [
        { nome: 'Boletim de Medição - UE', link: 'relatorio/gerencial' },
        { nome: 'Boletim de Medição - Contrato', link: 'relatorio/contrato' },
        { nome: 'Pontuação - Contrato', link: 'relatorio/contrato-pontos' },
        { nome: 'Agendamento Manual', link: 'relatorio/agendamento-manual' }
      ]
    },
  ];

}

async function alterarSenha(req, res) {

  let model = req.body;

  if (model.novaSenha !== model.confirmacaoNovaSenha) {
    return await ctrl.gerarRetornoErro(res, 'A nova senha e confirmação da senha devem ser iguais.');
  }

  if (model.senhaAtual == model.novaSenha) {
    return await ctrl.gerarRetornoErro(res, 'A nova senha deve ser diferente da senha atual.');
  }

  let usuario = await dao.findById(req.userData.idUsuario);
  if (usuario == null || !bcrypt.compareSync(model.senhaAtual, usuario.senha)) {
    return await ctrl.gerarRetornoErro(res, 'Senha atual inválida.');
  }

  let hashSenha = bcrypt.hashSync(model.novaSenha, 10);

  dao.atualizarSenhaUsuario(req.userData.idUsuario, hashSenha);
  await ctrl.gerarRetornoOk(res);

}

/* ==========================================================
/* UTILS
/* ==========================================================*/

async function enviarEmailNovoFiscal(usuarioLogado, nomeFiscal, emailFiscal, idUsuarioCargo, idUnidadeEscolar, urlNomeacao) {

  if (![
    UsuarioCargoConstants.FISCAL_TITULAR,
    UsuarioCargoConstants.FISCAL_SUPLENTE
  ].includes(idUsuarioCargo)) {
    return true;
  }

  await enviarEmailEventoFiscal(
    'Fiscal Cadastrado - ' + nomeFiscal,
    usuarioLogado,
    nomeFiscal,
    emailFiscal,
    idUnidadeEscolar,
    urlNomeacao
  );

}

async function enviarEmailAtualizacaoFiscal(usuarioLogado, idUsuarioStatusAtual, idUsuarioStatusNovo, nomeFiscal, emailFiscal, idUsuarioCargo, idUnidadeEscolar, urlNomeacao) {

  if (![UsuarioCargoConstants.FISCAL_TITULAR, UsuarioCargoConstants.FISCAL_SUPLENTE].includes(idUsuarioCargo)) {
    return true;
  }

  const statusAtual = await usuarioStatusDao.findById(idUsuarioStatusAtual);
  const statusNovo = await usuarioStatusDao.findById(idUsuarioStatusNovo);

  if (statusAtual.flagPodeLogar && !statusNovo.flagPodeLogar) {

    await enviarEmailEventoFiscal(
      'Fiscal Desativado - ' + nomeFiscal,
      usuarioLogado,
      nomeFiscal,
      emailFiscal,
      idUnidadeEscolar,
      urlNomeacao
    );

  }

}

async function enviarEmailEventoFiscal(assuntoEmail, usuarioLogado, nomeFiscal, emailFiscal, idUnidadeEscolar, urlNomeacao) {
   
  const verificacaoEmailFiscal = await ctrl.verificarEmailAtivo('EMAIL_NOTIFICACAO_FISCAL');
  if (verificacaoEmailFiscal.valor !== 1) {
    return;
  }

  const unidadeEscolar = await unidadeEscolarDao.buscarDetalhe(idUnidadeEscolar);

  // Busca o Prestador de Serviço para ler as configurações de e-mail do CSV
  const prestador = await dao.buscarIdPrestadorPorUnidadeEscolar(idUnidadeEscolar);
  let emailsAdicionaisPs = '';
  let notificacaoPsAtiva = true; // Mantém ativo por padrão se não houver arquivo configurado

  if (prestador && prestador.id) {
    const configPs = await configuracaoService.obterObjetoConfiguracaoPs(prestador.id);
    notificacaoPsAtiva = configPs.ocorrenciaAtivo;
    emailsAdicionaisPs = configPs.ocorrenciaEmails;
  }

  // Caso o item ativo não seja true, não envia o e-mail conforme solicitado
  if (!notificacaoPsAtiva) {
    console.log(`[INFO] Notificação abortada: Prestador da UE ${idUnidadeEscolar} está com notificações desativadas no CSV.`);
    return;
  }

  // Busca os usuários do Prestador de Serviço do banco de dados
  const usuariosPS = await dao.buscarUsuariosPrestadoresPorContratoAtivoUE(idUnidadeEscolar);
  
  let destinatarios = (unidadeEscolar.diretoriaRegional.email || '') + ';';
  usuariosPS.forEach(u => { if (u.email) destinatarios += u.email + ';'; });

  if (emailsAdicionaisPs) {
    destinatarios += emailsAdicionaisPs + (emailsAdicionaisPs.endsWith(';') ? '' : ';');
  }

  const html = `
        <br><b>Usuário Logado:</b> ${usuarioLogado.nome}
        <br><b>Nome do Fiscal:</b> ${nomeFiscal}
        <br><b>E-mail do Fiscal:</b> ${emailFiscal}
        <br><b>Código da UE:</b> ${unidadeEscolar.codigo}
        <br><b>Nome da UE:</b> ${unidadeEscolar.descricao}
        <br><b>URL de Nomeação:</b> ${urlNomeacao}
        <br>
        <br>E-mail enviado automaticamente, favor não responder.
        <br>Sistema de Limpeza | SME-SP<br>
    `;

  return await emailService.enviar(destinatarios, assuntoEmail, html);

}