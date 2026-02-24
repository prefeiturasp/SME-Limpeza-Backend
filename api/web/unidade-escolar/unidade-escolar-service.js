const ctrl = require('rfr')('core/controller.js');
const csv = require('rfr')('core/utils/csv.js');
const geo = require('rfr')('core/utils/geo.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./unidade-escolar-dao');
const DaoUsuario = require('../usuario/usuario/usuario-dao');
const DaoAmbienteUnidadeEscolar = require('../plano-trabalho/ambiente/ambiente-unidade-escolar/ambiente-unidade-escolar-dao');

const dao = new Dao();
const daoUsuario = new DaoUsuario();
const daoAmbienteUnidadeEscolar = new DaoAmbienteUnidadeEscolar();

exports.buscar = buscar;
exports.buscarDetalhe = buscarDetalhe;
exports.tabela = tabela;
exports.importar = importar;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;
exports.comboTipoEscola = comboTipoEscola;
exports.combo = combo;
exports.comboPorDRE = comboPorDRE;
exports.comboTodos = comboTodos;
exports.comboDetalhado = comboDetalhado;
exports.carregarComboDetalhadoTodos = carregarComboDetalhadoTodos;

async function buscar(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const unidadeEscolar = await dao.findById(req.params.id);
  await ctrl.gerarRetornoOk(res, unidadeEscolar);

}

async function buscarDetalhe(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const unidadeEscolar = await dao.buscarDetalhe(req.params.id);
  await ctrl.gerarRetornoOk(res, unidadeEscolar);

}

async function tabela(req, res) {
  const params = await utils.getDatatableParams(req);
  const idUnidadeEscolar = req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : null;
  const idDiretoriaRegional = params.filters.idDiretoriaRegional ? params.filters.idDiretoriaRegional : req.userData.origem.codigo === 'dre' ? req.userData.idOrigemDetalhe : null;
  const tabela = await dao.datatable(params.filters.idTipoEscola, idUnidadeEscolar, idDiretoriaRegional, params.filters.descricao, params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

async function importar(req, res) {

  const idDiretoriaRegional = req.params.idDiretoriaRegional;
  const _transaction = await ctrl.iniciarTransaction();
  let cepConsulta, numeroConsulta, endereco, coordenadas;

  try {

    const comboTipoEscola = await dao.comboTipoEscola();
    const unidadeEscolarList = await csv.converterFromCsv(req.file);

    const estrutura = ['descricao', 'codigo', 'cep', 'numero', 'telefone', 'email', 'tipo'];
    const estruturaInvalida = await csv.verificarEstruturaInvalida(unidadeEscolarList, estrutura);

    if (estruturaInvalida) {
      throw estruturaInvalida;
    }

    for (const ue of unidadeEscolarList) {

      if (cepConsulta != ue.cep) {
        endereco = await geo.buscarCep(ue.cep);
        endereco.numero = ue.numero;
        cepConsulta = ue.cep;
        const enderecoInvalido = await verificarImportacaoEnderecoInvalido(endereco);
        if (enderecoInvalido) {
          ue.classeResultado = 'danger';
          ue.mensagemResultado = enderecoInvalido;
          continue;
        }
      }

      if (numeroConsulta != ue.numero) {
        numeroConsulta = ue.numero;
        coordenadas = await geo.buscarCoordenadas(endereco);
        if (!coordenadas) {
          ue.classeResultado = 'danger';
          ue.mensagemResultado = 'Coordenadas inválidas.';
          continue;
        }
      }

      const tipoEscola = await comboTipoEscola.find(t => t.descricao == ue.tipo);

      if (!(/^[0-9]{10,11}$/.test(ue.telefone)) || !tipoEscola) {
        ue.classeResultado = 'danger';
        ue.mensagemResultado = `${!tipoEscola ? 'Tipo' : 'Telefone'} inválido.`;
        continue;
      }

      const ueExistente = await dao.buscarPorCodigoAndDiretoriaRegional(ue.codigo, idDiretoriaRegional, _transaction);

      if (ueExistente) {
        ue.classeResultado = 'info';
        ue.mensagemResultado = 'Atualizado com sucesso.';
        await dao.atualizar(ueExistente.id, ue.descricao, ue.codigo, endereco.endereco, endereco.numero, endereco.bairro, ue.cep, coordenadas.lat, coordenadas.lng, ue.telefone, ue.email, tipoEscola.id, idDiretoriaRegional, JSON.stringify(ueExistente.responsavelLegalLista), _transaction);
      } else {
        ue.classeResultado = 'success';
        ue.mensagemResultado = 'Cadastrado com sucesso.';
        await dao.insert(ue.descricao, ue.codigo, endereco.endereco, endereco.numero, endereco.bairro, ue.cep, coordenadas.lat, coordenadas.lng, ue.telefone, ue.email, tipoEscola.id, idDiretoriaRegional, JSON.stringify([]), _transaction);
      }

    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res, unidadeEscolarList);

  } catch (error) {
    console.log(error)
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, typeof error == 'string' ? error : null);
  }


}

async function inserir(req, res) {

  const ueExistente = await dao.buscarPorCodigo(req.body.codigo);

  if (ueExistente && ueExistente.flagAtivo) {
    return await ctrl.gerarRetornoErro(res, 'Já existe Unidade Escolar com o código informado.');
  }

  const responsavelLegalLista = req.body.responsavelLegalLista || [];
  await dao.insert(req.body.descricao, req.body.codigo, req.body.endereco, req.body.numero, req.body.bairro, req.body.cep, req.body.latitude, req.body.longitude, req.body.telefone, req.body.email, req.body.idTipoEscola, req.body.idDiretoriaRegional, JSON.stringify(responsavelLegalLista));
  await ctrl.gerarRetornoOk(res);
}

async function atualizar(req, res) {

  const id = parseInt(req.params.id);

  if (id !== req.body.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const ueExistente = await dao.buscarPorCodigo(req.body.codigo);

  if (ueExistente && ueExistente.id !== id && ueExistente.flagAtivo) {
    return await ctrl.gerarRetornoErro(res, 'Já existe Unidade Escolar com o código informado.');
  }

  const responsavelLegalLista = req.body.responsavelLegalLista || [];
  await dao.atualizar(id, req.body.descricao, req.body.codigo, req.body.endereco, req.body.numero, req.body.bairro, req.body.cep, req.body.latitude, req.body.longitude, req.body.telefone, req.body.email, req.body.idTipoEscola, req.body.idDiretoriaRegional, JSON.stringify(responsavelLegalLista));
  await ctrl.gerarRetornoOk(res);

}

async function remover(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {
    await daoAmbienteUnidadeEscolar.removerPorUnidadeEscolar(_transaction, req.params.id);
    await dao.remover(_transaction, req.params.id);
    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    console.log(error)
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, typeof error == 'string' ? error : null);
  }

}

async function comboTipoEscola(req, res) {
  const combo = await dao.comboTipoEscola();
  await ctrl.gerarRetornoOk(res, combo);
}

async function combo(req, res) {

  if (req.userData.origem.codigo === 'sme') {
    const contratoList = await daoUsuario.comboContratoPorUsuarioSME(req.userData.idUsuario);
    const idContratoList = contratoList.map(c => c.id);
    const unidadeEscolarList = await dao.comboPorContratos(idContratoList);
    return await ctrl.gerarRetornoOk(res, unidadeEscolarList);
  }

  switch (req.userData.origem.codigo) {
    case 'dre': return await ctrl.gerarRetornoOk(res, await dao.comboPorDRE(req.userData.idOrigemDetalhe));
    case 'ue': return await ctrl.gerarRetornoOk(res, [await dao.buscar(req.userData.idOrigemDetalhe)]);
    case 'ps': return await ctrl.gerarRetornoOk(res, await dao.comboPorPrestadorServicoAndUsuario(req.userData.idUsuario, req.userData.idOrigemDetalhe));
    default: return await ctrl.gerarRetornoOk(res, []);
  }
}

async function comboPorDRE(req, res) {

  if (req.userData.origem.codigo != 'sme') {
    return await ctrl.gerarRetornoOk(res, []);
  }

  if (!req.params.idDiretoriaRegional) {
    return await ctrl.gerarRetornoErro(res, 'DRE não foi informada.');
  }

  return await ctrl.gerarRetornoOk(res, await dao.comboPorDRE(req.params.idDiretoriaRegional));

}

async function comboTodos(req, res) {

  if (req.userData.origem.codigo === 'sme') {
    const contratoList = await daoUsuario.comboContratoPorUsuarioSME(req.userData.idUsuario);
    const idContratoList = contratoList.map(c => c.id);
    const unidadeEscolarList = await dao.comboTodosPorContratos(idContratoList);
    return await ctrl.gerarRetornoOk(res, unidadeEscolarList);
  }

  switch (req.userData.origem.codigo) {
    case 'dre': return await ctrl.gerarRetornoOk(res, await dao.comboTodosDiretoriaRegional(req.userData.idOrigemDetalhe));
    case 'ue': return await ctrl.gerarRetornoOk(res, [await dao.buscar(req.userData.idOrigemDetalhe)]);
    case 'ps': return await ctrl.gerarRetornoOk(res, await dao.comboTodosPorPrestadorServicoAndUsuario(req.userData.idUsuario, req.userData.idOrigemDetalhe));
    default: return await ctrl.gerarRetornoOk(res, []);
  }
}

async function comboDetalhado(req, res) {
  const combo = await dao.comboDetalhado();
  await ctrl.gerarRetornoOk(res, combo);
}

async function carregarComboDetalhadoTodos(req, res) {
  const idUsuarioPrestador = req.userData.origem.codigo == 'ps' ? req.userData.idUsuario : null;
  const combo = await dao.carregarComboDetalhadoTodos(idUsuarioPrestador);
  await ctrl.gerarRetornoOk(res, combo);
}

// ##################################################################################################################
// utils

const verificarImportacaoEnderecoInvalido = async (endereco) => {

  if (!endereco) {
    return 'CEP inválido';
  }

  if (endereco.uf != 'SP' || endereco.municipio != 'São Paulo') {
    return 'Não é São Paulo/SP';
  }

  return false;

};