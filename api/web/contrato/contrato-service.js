const moment = require('moment');

const ctrl = require('rfr')('core/controller.js');
const csv = require('rfr')('core/utils/csv.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./contrato-dao');
const UnidadeEscolarDao = require('../unidade-escolar/unidade-escolar-dao');
const UsuarioDao = require('../usuario/usuario/usuario-dao');
const CargoDao = require('../cargo/cargo-dao');

const dao = new Dao();
const unidadeEscolarDao = new UnidadeEscolarDao();
const usuarioDao = new UsuarioDao();
const cargoDao = new CargoDao();

exports.buscar = async (req, res) => {

  if (!req.params.id) {
    return await ctrl.gerarRetornoErro(res);
  }

  let contrato = await dao.buscar(req.params.id);
  let novaListaUnidadeEscolar = [];

  for (let unidadeEscolar of contrato.unidadeEscolarLista) {
    let ue = await unidadeEscolarDao.buscarDetalhe(unidadeEscolar.idUnidadeEscolar);
    ue.dataInicial = unidadeEscolar.dataInicial;
    ue.dataFinal = unidadeEscolar.dataFinal;
    ue.valor = unidadeEscolar.valor;
    ue.equipeLista = await dao.buscarEquipe(req.params.id, unidadeEscolar.idUnidadeEscolar);
    novaListaUnidadeEscolar.push(ue);
  }

  novaListaUnidadeEscolar.sort((a, b) =>
    (a.descricao || '').localeCompare(b.descricao || '', 'pt', { sensitivity: 'base' })
  );

  contrato.unidadeEscolarLista = novaListaUnidadeEscolar;
  contrato.reajusteLista = await dao.buscarReajustes(req.params.id);
  await ctrl.gerarRetornoOk(res, contrato);

}

exports.buscarVencimentoProximo = async (req, res) => {
  const contratos = await dao.buscarVencimentoProximo(180, moment());
  await ctrl.gerarRetornoOk(res, contratos);
}

exports.tabela = async (req, res) => {
  const params = await utils.getDatatableParams(req);
  const { filters, length, start } = params;
  const tabela = await dao.datatable(filters.codigo, filters.prestadorServico?.id, length, start);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

exports.combo = async (req, res) => {

  if (req.userData.origem.codigo !== 'sme') {
    return ctrl.gerarRetornoOk(res, []);
  }

  const contratos = await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario);
  return ctrl.gerarRetornoOk(res, contratos);

}

exports.comboTodos = async (req, res) => {

  if (req.userData.origem.codigo !== 'sme') {
    return ctrl.gerarRetornoOk(res, []);
  }

  const contratos = await dao.comboTodos();
  return ctrl.gerarRetornoOk(res, contratos);

}

exports.comboEquipe = async (req, res) => {

  const idUnidadeEscolar = req.userData.idOrigemDetalhe;

  if (req.userData.origem.codigo !== 'ue') {
    return ctrl.gerarRetornoOk(res, []);
  }

  if (!req.query.data) {
    return await ctrl.gerarRetornoErro(res, 'Requisição sem a informação da data da ocorrência.');
  }

  try {

    const unidadeEscolar = await unidadeEscolarDao.findById(idUnidadeEscolar);
    const contrato = await unidadeEscolarDao.buscarContrato(idUnidadeEscolar, moment(req.query.data).format('YYYY-MM-DD'));

    if (!contrato) {
      return await ctrl.gerarRetornoErro(res, 'Unidade Escolar não possui contrato ativo para a data.');
    }

    const cargos = await dao.buscarEquipe(contrato.idContrato, unidadeEscolar.idUnidadeEscolar);
    return ctrl.gerarRetornoOk(res, cargos);

  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }



}

exports.carregarArquivoUnidadeEscolar = async (req, res) => {

  try {

    const unidadeEscolarList = await csv.converterFromCsv(req.file);
    const estrutura = ['codigo', 'valor', 'data_inicial', 'data_final'];
    const estruturaInvalida = await csv.verificarEstruturaInvalida(unidadeEscolarList, estrutura);

    if (estruturaInvalida) {
      throw estruturaInvalida;
    }

    for (const ue of unidadeEscolarList) {

      const unidadeEscolar = await unidadeEscolarDao.buscarPorCodigo(ue.codigo);

      if (!unidadeEscolar) {
        ue.classeResultado = 'danger';
        ue.mensagemResultado = 'UE não encontrada';
        delete ue.codigo;
        delete ue.valor;
        continue;
      }

      ue.id = unidadeEscolar.id;
      ue.descricao = unidadeEscolar.descricao;
      ue.endereco = unidadeEscolar.endereco;
      ue.numero = unidadeEscolar.numero;
      ue.bairro = unidadeEscolar.bairro;
      ue.cep = unidadeEscolar.cep;
      ue.latitude = unidadeEscolar.latitude;
      ue.longitude = unidadeEscolar.longitude;
      ue.email = unidadeEscolar.email;
      ue.telefone = unidadeEscolar.telefone;
      ue.responsavelLegalLista = unidadeEscolar.responsavelLegalLista;
      ue.tipoEscola = unidadeEscolar.tipoEscola;
      ue.diretoriaRegional = unidadeEscolar.diretoriaRegional;
      ue.flagAtivo = unidadeEscolar.flagAtivo;
      ue.dataInicial = utils.parseDate(ue.data_inicial);
      ue.dataFinal = utils.parseDate(ue.data_final);
      ue.valor = utils.parseNumberCsv(ue.valor);
      ue.classeResultado = 'success';

      if (isNaN(ue.valor) || ue.valor < 0.0) {
        ue.classeResultado = 'danger';
        ue.mensagemResultado = 'Valor inválido';
        continue;
      }

      if (!moment(ue.dataInicial, 'DD/MM/YYYY', true).isValid()) {
        ue.classeResultado = 'danger';
        ue.mensagemResultado = 'Data inicial inválida';
        continue;
      }

      if (!moment(ue.dataFinal, 'DD/MM/YYYY', true).isValid()) {
        ue.classeResultado = 'danger';
        ue.mensagemResultado = 'Data final inválida';
        continue;
      }

      if (moment(ue.dataInicial).isAfter(ue.dataFinal)) {
        ue.classeResultado = 'danger';
        ue.mensagemResultado = 'Data inicial maior';
        continue;
      }

    }

    await ctrl.gerarRetornoOk(res, unidadeEscolarList);

  } catch (error) {
    console.log({ error })
    await ctrl.gerarRetornoErro(res, typeof error === 'string' ? error : null);
  }

}

exports.carregarArquivoCargo = async (req, res) => {

  try {

    const cargoList = await csv.converterFromCsv(req.file);
    const estrutura = ['codigo_ue', 'nome_cargo', 'quantidade', 'valor_mensal'];
    const estruturaInvalida = await csv.verificarEstruturaInvalida(cargoList, estrutura);

    if (estruturaInvalida) {
      throw estruturaInvalida;
    }

    for (const c of cargoList) {

      c.valor_mensal = utils.parseNumberCsv(c.valor_mensal);

      const unidadeEscolar = await unidadeEscolarDao.buscarPorCodigo(c['codigo_ue']);

      if (!unidadeEscolar) {
        c.classeResultado = 'danger';
        c.mensagemResultado = 'UE não encontrada';
        continue;
      }

      c.unidadeEscolar = {
        id: unidadeEscolar.id,
        codigo: unidadeEscolar.codigo,
        descricao: unidadeEscolar.descricao,
      }

      const cargo = await cargoDao.buscarPorDescricaoAndAtivo(c['nome_cargo']);

      if (!cargo) {
        c.classeResultado = 'danger';
        c.mensagemResultado = 'Cargo não encontrado';
        continue;
      }

      c.id = cargo.id;
      c.descricao = cargo.descricao;
      c.quantidade = parseInt(c.quantidade);
      c.classeResultado = 'success';

      if (isNaN(c.quantidade) || c.quantidade <= 0) {
        c.classeResultado = 'danger';
        c.mensagemResultado = 'Quantidade inválida';
        continue;
      }

      if (isNaN(c.valor_mensal) || c.valor_mensal < 0.0) {
        c.classeResultado = 'danger';
        c.mensagemResultado = 'Valor mensal é inválido';
        continue;
      }

    }

    await ctrl.gerarRetornoOk(res, cargoList);

  } catch (error) {
    console.log({ error })
    await ctrl.gerarRetornoErro(res, typeof error === 'string' ? error : null);
  }

}

exports.inserir = async (req, res) => {

  const { descricao, codigo, nomeResponsavel, emailResponsavel, idPrestadorServico, valorTotal, numeroPregao, nomeLote, modelo } = req.body;

  const unidadeEscolarLista = req.body.unidadeEscolarLista || [];
  const reajusteLista = (req.body.reajusteLista || []).filter(v => v.flagAtivo === true);

  const _transaction = await ctrl.iniciarTransaction();

  try {

    if (unidadeEscolarLista.length === 0) {
      return await ctrl.gerarRetornoErro(res, `Nenhuma Unidade Escolar relacionada ao contrato.`);
    }

    unidadeEscolarLista.forEach(ue => {
      ue.dataInicial = utils.parseDate(ue.dataInicial);
      ue.dataFinal = utils.parseDate(ue.dataFinal);
    })

    const dataInicial = unidadeEscolarLista.reduce((menor, ue) => moment.min(menor, moment(ue.dataInicial)), moment(unidadeEscolarLista[0].dataInicial));
    const dataFinal = unidadeEscolarLista.reduce((maior, ue) => moment.max(maior, moment(ue.dataFinal)), moment(unidadeEscolarLista[0].dataFinal));

    const dateList = reajusteLista.filter(v => v.flagAtivo === true).map(v => v.dataInicial);
    const isDuplicated = dateList.some((v, i) => dateList.indexOf(v) != i);

    if (isDuplicated) {
      return await ctrl.gerarRetornoErro(res, `Existem reajustes com datas iguais.`);
    }

    for (const ue of unidadeEscolarLista) {

      const contratoDataInicial = await unidadeEscolarDao.buscarContrato(ue.id, ue.dataInicial);
      if (contratoDataInicial) {
        await ctrl.finalizarTransaction(false, _transaction);
        return await ctrl.gerarRetornoErro(res, `A UE de código ${ue.codigo} está em conflito de datas com o contrato de código ${contratoDataInicial.codigo}.`);
      }

      const contratoDataFinal = await unidadeEscolarDao.buscarContrato(ue.id, ue.dataFinal);
      if (contratoDataFinal) {
        await ctrl.finalizarTransaction(false, _transaction);
        return await ctrl.gerarRetornoErro(res, `A UE de código ${ue.codigo} está em conflito de datas com o contrato de código ${contratoDataFinal.codigo}.`);
      }

    }

    const idContrato = await dao.insert(_transaction, descricao, codigo, dataInicial, dataFinal, nomeResponsavel, emailResponsavel, idPrestadorServico, valorTotal, numeroPregao, nomeLote, modelo);

    for (let unidadeEscolar of unidadeEscolarLista) {
      await dao.insertUnidadeEscolar(_transaction, idContrato, unidadeEscolar.id, unidadeEscolar.valor, unidadeEscolar.dataInicial, unidadeEscolar.dataFinal);
      unidadeEscolarLista.map(async (ue) => await usuarioDao.insertGestorPrestadorUnidadeEscolar(idPrestadorServico, unidadeEscolar.id, _transaction));
    }

    for (let reajuste of reajusteLista) {
      await dao.insertReajuste(_transaction, idContrato, reajuste.dataInicial, reajuste.percentual);
    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res);
  }

}

exports.atualizar = async (req, res) => {

  const { id, descricao, codigo, nomeResponsavel, emailResponsavel, idPrestadorServico, valorTotal, numeroPregao, nomeLote, modelo } = req.body;

  if (req.params.id != id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const unidadeEscolarLista = req.body.unidadeEscolarLista || [];
  const reajusteLista = req.body.reajusteLista || [];

  const _transaction = await ctrl.iniciarTransaction();

  try {

    if (unidadeEscolarLista.length === 0) {
      return await ctrl.gerarRetornoErro(res, `Nenhuma Unidade Escolar vinculada ao contrato.`);
    }

    unidadeEscolarLista.forEach(ue => {
      ue.dataInicial = utils.parseDate(ue.dataInicial);
      ue.dataFinal = utils.parseDate(ue.dataFinal);
    });

    const dataInicial = unidadeEscolarLista.reduce((menor, ue) => moment.min(menor, moment(ue.dataInicial)), moment(unidadeEscolarLista[0].dataInicial));
    const dataFinal = unidadeEscolarLista.reduce((maior, ue) => moment.max(maior, moment(ue.dataFinal)), moment(unidadeEscolarLista[0].dataFinal));

    const dateList = reajusteLista.filter(v => v.flagAtivo === true).map(v => v.dataInicial);
    const isDuplicated = dateList.some((v, i) => dateList.indexOf(v) != i);

    if (isDuplicated) {
      return await ctrl.gerarRetornoErro(res, `Existem reajustes com datas iguais.`);
    }

    for (const ue of unidadeEscolarLista) {

      const contratoDataInicial = await unidadeEscolarDao.buscarContrato(ue.id, ue.dataInicial);
      if (contratoDataInicial && contratoDataInicial.idContrato !== id) {
        await ctrl.finalizarTransaction(false, _transaction);
        return await ctrl.gerarRetornoErro(res, `A UE de código ${ue.codigo} está em conflito de datas com o contrato de código ${contratoDataInicial.codigo}.`);
      }

      const contratoDataFinal = await unidadeEscolarDao.buscarContrato(ue.id, ue.dataFinal);
      if (contratoDataFinal && contratoDataFinal.idContrato !== id) {
        await ctrl.finalizarTransaction(false, _transaction);
        return await ctrl.gerarRetornoErro(res, `A UE de código ${ue.codigo} está em conflito de datas com o contrato de código ${contratoDataFinal.codigo}.`);
      }

    }

    await dao.atualizar(
      _transaction,
      id,
      descricao,
      codigo,
      dataInicial,
      dataFinal,
      nomeResponsavel,
      emailResponsavel,
      idPrestadorServico,
      parseFloat(valorTotal).toFixed(2),
      numeroPregao,
      nomeLote,
      modelo
    );
    await dao.removerUnidadesEscolares(_transaction, id);
    await dao.removerEquipes(_transaction, id);

    function normaVal(v) {
      if (v === undefined || v === null) return null;
      const n = Number(v);
      return Number.isNaN(n) ? String(v) : n;
    }

    for (const unidadeEscolar of unidadeEscolarLista) {
      const unidadeId = unidadeEscolar.id || unidadeEscolar.idUnidadeEscolar;
      if (!unidadeId) {
        console.warn('Unidade sem id (pulando):', unidadeEscolar);
        continue;
      }

      await dao.insertUnidadeEscolar(
        _transaction,
        id,
        unidadeId,
        unidadeEscolar.valor,
        unidadeEscolar.dataInicial,
        unidadeEscolar.dataFinal
      );

      await usuarioDao.insertGestorPrestadorUnidadeEscolar(
        idPrestadorServico,
        unidadeId,
        _transaction
      );

      const novoStatusRaw =
        unidadeEscolar.idStatusUnidadeEscolar ??
        unidadeEscolar.id_status_unidade_escolar;

      const novoStatus = normaVal(novoStatusRaw);
      const motivo = unidadeEscolar.motivoStatus || unidadeEscolar.motivo_status || null;

      console.log(
        `-- processando UE ${unidadeId} -> novoStatusRaw:`,
        novoStatusRaw,
        ' -> novoStatus(normal):',
        novoStatus,
        ' motivo:',
        motivo
      );

      await unidadeEscolarDao.atualizarStatusNoContrato(
        _transaction,
        id,
        unidadeId,
        novoStatus,
        motivo
      );

      for (const eq of unidadeEscolar.equipeLista || []) {
        await dao.insertEquipe(
          _transaction,
          id,
          unidadeId,
          eq.id,
          eq.quantidade,
          eq.valorMensal
        );
      }
    }

    await usuarioDao.removerPrestadorUnidadeEscolarSemContrato(_transaction);

    for (const r of reajusteLista) {

      if (!r.idContratoReajuste && r.flagAtivo) {
        await dao.insertReajuste(_transaction, id, r.dataInicial, r.percentual);
      } else if (!r.flagAtivo) {
        await dao.removerReajuste(_transaction, id, r.idContratoReajuste);
      }

    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res);
  }

}

exports.remover = async (req, res) => {

  const idContrato = req.params.id;

  if (!idContrato) {
    return await ctrl.gerarRetornoErro(res);
  }

  const relatorios = await dao.buscarRelatoriosGerenciais(idContrato);

  if (relatorios && relatorios.length > 0) {
    return await ctrl.gerarRetornoErro(res, 'Não é possível remover um contrato que possui boletins de medição vinculado.');
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {
    await dao.removerUnidadesEscolares(_transaction, idContrato);
    await dao.removerEquipes(_transaction, idContrato);
    await dao.removerReajustes(_transaction, idContrato);
    await dao.removerUsuariosSME(_transaction, idContrato);
    await dao.remover(_transaction, idContrato);
    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res);
  } catch (error) {
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res);
  }

}