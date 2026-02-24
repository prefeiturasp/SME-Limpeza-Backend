const ctrl = require('rfr')('core/controller.js');
const csv = require('rfr')('core/utils/csv.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./diretoria-regional-dao');
const DaoUnidadeEscolar = require('../unidade-escolar/unidade-escolar-dao');

const dao = new Dao();
const daoUnidadeEscolar = new DaoUnidadeEscolar();

exports.buscar = buscar;
exports.tabela = tabela;
exports.importar = importar;
exports.inserir = inserir;
exports.atualizar = atualizar;
exports.remover = remover;
exports.combo = combo;
exports.comboTodos = comboTodos;

async function buscar(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const response = await dao.findById(req.params.id);
  await ctrl.gerarRetornoOk(res, response);

}

async function tabela(req, res) {
  const params = await utils.getDatatableParams(req);
  const idDiretoriaRegional = req.userData.origem.codigo === 'dre' ? req.userData.idOrigemDetalhe : null;
  const tabela = await dao.datatable(params.filters.descricao, idDiretoriaRegional, params.length, params.start);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

async function importar(req, res) {

  const _transaction = await ctrl.iniciarTransaction();

  try {

    const diretoriaRegionalList = await csv.converterFromCsv(req.file);

    const estrutura = ['descricao', 'endereco', 'bairro', 'cep', 'telefone', 'email'];
    const estruturaInvalida = await csv.verificarEstruturaInvalida(diretoriaRegionalList, estrutura);

    if (estruturaInvalida) {
      throw estruturaInvalida;
    }

    for (const dre of diretoriaRegionalList) {

      const cepValido = /^[0-9]{8}$/.test(dre.cep);
      const telefoneValido = /^[0-9]{10,11}$/.test(dre.telefone);

      if (!cepValido || !telefoneValido) {
        dre.classeResultado = 'danger';
        dre.mensagemResultado = `${!cepValido ? 'CEP' : 'Telefone'} inválido.`;
        continue;
      }

      const dreExistente = await dao.buscarPorDescricaoAndAtivo(dre.descricao, _transaction);

      if (dreExistente) {
        dre.classeResultado = 'success';
        dre.mensagemResultado = 'Atualizado com sucesso.';
        await dao.atualizar(dreExistente.id, dreExistente.descricao, dre.endereco, dre.bairro, dre.cep, dre.telefone, dre.email, _transaction);
      } else {
        dre.classeResultado = 'success';
        dre.mensagemResultado = 'Cadastrado com sucesso.';
        await dao.insert(dre.descricao, dre.endereco, dre.bairro, dre.cep, dre.telefone, dre.email, _transaction);
      }

    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res, diretoriaRegionalList);

  } catch (error) {
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, typeof error === 'string' ? error : null);
  }

}

async function inserir(req, res) {
  await dao.insert(req.body.descricao, req.body.endereco, req.body.bairro, req.body.cep, req.body.telefone, req.body.email);
  await ctrl.gerarRetornoOk(res);
}

async function atualizar(req, res) {

  if (req.params.id != req.body.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  await dao.atualizar(req.params.id, req.body.descricao, req.body.endereco, req.body.bairro, req.body.cep, req.body.telefone, req.body.email);
  await ctrl.gerarRetornoOk(res);

}

async function remover(req, res) {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {
    await dao.remover(_transaction, req.params.id);
    await daoUnidadeEscolar.removerByIdDiretoriaRegional(_transaction, req.params.id);
    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res);
  }

}

async function combo(req, res) {
  switch (req.userData.origem.codigo) {
    case 'sme': return await ctrl.gerarRetornoOk(res, await dao.combo(req.userData.idOrigemDetalhe));
    case 'dre': return await ctrl.gerarRetornoOk(res, [await dao.buscar(req.userData.idOrigemDetalhe)]);
    default: return await ctrl.gerarRetornoOk(res, []);
  }
}

async function comboTodos(req, res) {
  switch (req.userData.origem.codigo) {
    case 'sme': return await ctrl.gerarRetornoOk(res, await dao.comboTodos(req.userData.idOrigemDetalhe));
    case 'dre': return await ctrl.gerarRetornoOk(res, [await dao.buscar(req.userData.idOrigemDetalhe)]);
    default: return await ctrl.gerarRetornoOk(res, []);
  }
}