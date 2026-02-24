const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');
const csv = require('rfr')('core/utils/csv.js');
const bcrypt = require('bcrypt');
const emailService = require('rfr')('core/email');

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
exports.importar = importar;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;
exports.menu = menu;
exports.alterarSenha = alterarSenha;

async function buscar(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const usuario = await dao.buscar(req.params.id);
  await ctrl.gerarRetornoOk(res, usuario);

}

async function tabela(req, res) {

  if (!['sme', 'dre', 'ps'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const params = await utils.getDatatableParams(req);
  const idOrigemDetalheList = params.filters.idOrigemDetalhe?.id ? [params.filters.idOrigemDetalhe.id] : await buscarOrigemDetalheListagem(req.userData);
  const idUsuarioOrigemList = params.filters.idUsuarioOrigem ? [params.filters.idUsuarioOrigem] : await buscarUsuarioOrigemListagem(req.userData);
  const idContratoList = req.userData.origem.codigo !== 'sme' ? null : (await dao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const tabela = await dao.datatable(params.filters.nome, params.filters.email, params.filters.idUsuarioCargo, idOrigemDetalheList, idUsuarioOrigemList, idContratoList, params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

async function importar(req, res) {

  if (!['sme', 'dre', 'ps'].includes(req.userData.origem.codigo)) {
    return await ctrl.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    const usuarioList = await csv.converterFromCsv(req.file);

    if (!usuarioList[0].nome || !usuarioList[0].email || !usuarioList[0].id_origem) {
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
          usuario.mensagemResultado = `URL nomeação inválido.`;
          continue;
        }

      }

      const usuarioExistente = await dao.findDetalhadoByEmail(usuario.email, _transaction);

      if (usuarioExistente) {
        usuario.classeResultado = 'info';
        usuario.mensagemResultado = 'Atualizado com sucesso.';
        await dao.atualizar(
          usuarioExistente.id,
          usuario.nome,
          usuarioExistente.email,
          usuarioExistente.senha,
          usuarioExistente.idUsuarioStatus,
          usuario.idUsuarioCargo,
          usuario.idOrigemDetalhe,
          usuario.url_nomeacao,
          _transaction
        );

      } else {
        usuario.classeResultado = 'success';
        usuario.mensagemResultado = 'Cadastrado com sucesso.';
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

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res, usuarioList);

  } catch (error) {
    console.log(error)
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, typeof error === 'string' ? error : null);
  }

}

async function buscarOrigemDetalheListagem(userData) {

  let idOrigemDetalheList = [userData.idOrigemDetalhe];

  if (userData.origem.codigo === 'sme') {
    return null;
  }

  if (userData.origem.codigo === 'dre') {
    //Pode buscar usuários da DRE e das UE subordinadas.
    let unidadeEscolarList = await unidadeEscolarDao.comboTodosDiretoriaRegional(userData.idOrigemDetalhe);
    for (let ue of unidadeEscolarList) {
      idOrigemDetalheList.push(ue.id);
    }
  }

  return idOrigemDetalheList;

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
        // { nome: 'Ocorrências - Funcionários', link: 'relatorio/ocorrencia-funcionario' },
        { nome: 'Declarações', link: 'declaracao' }
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
        { nome: 'Declarações', link: 'declaracao' }
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
    {
      nome: 'Declarações',
      icone: 'icon-note',
      link: 'declaracao'
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

async function montarMenuGestorPS() {

  return [
    {
      nome: 'Painel Inicial',
      icone: 'icon-equalizer',
      link: 'painel-inicial'
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

  if (![
    UsuarioCargoConstants.FISCAL_TITULAR,
    UsuarioCargoConstants.FISCAL_SUPLENTE
  ].includes(idUsuarioCargo)) {
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

  const unidadeEscolar = await unidadeEscolarDao.buscarDetalhe(idUnidadeEscolar);
  const usuariosSME = await dao.comboPorOrigem(UsuarioOrigemConstants.SME);
  const destinatarios = usuariosSME.reduce((string, user) => (string + user.email + ';'), (unidadeEscolar.diretoriaRegional.email + ';'));

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