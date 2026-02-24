const ctrl = require('rfr')('core/controller');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./monitoramento-dao');
const dao = new Dao();

exports.buscarTurnos = async (req, res) => {

  try {
    const turnoList = await dao.buscarTurnos(req.idUnidadeEscolar, req.idPrestadorServico);
    await ctrl.gerarRetornoOk(res, turnoList || []);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

exports.buscarAmbienteGeralTurno = async (req, res) => {

  try {
    const ambienteGeralList = await dao.buscarAmbienteGeralTurno(req.idUnidadeEscolar, req.idPrestadorServico, req.params.idTurno);
    await ctrl.gerarRetornoOk(res, ambienteGeralList || []);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

exports.buscarMonitoramentos = async (req, res) => {

  const { idTurno, idAmbienteGeral } = req.params;

  try {
    const monitoramentoList = await dao.buscarMonitoramentos(req.idUnidadeEscolar, req.idPrestadorServico, idTurno, idAmbienteGeral);
    await ctrl.gerarRetornoOk(res, monitoramentoList || []);
  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

exports.buscarTodos = async (req, res) => {

  try {

    let turnoList = await dao.buscarTurnos(req.idUnidadeEscolar, req.idPrestadorServico);

    for (let turno of turnoList) {
      turno.ambienteGeralList = await dao.buscarAmbienteGeralTurno(req.idUnidadeEscolar, req.idPrestadorServico, turno.idTurno);
      for (let ambiente of turno.ambienteGeralList) {
        ambiente.monitoramentoList = await dao.buscarMonitoramentos(req.idUnidadeEscolar, req.idPrestadorServico, turno.idTurno, ambiente.idAmbienteGeral);
      }
    }

    await ctrl.gerarRetornoOk(res, turnoList);

  } catch (error) {
    console.log(error);
    await ctrl.gerarRetornoErro(res);
  }

}

exports.atualizar = async (req, res) => {

  const { id, dataHoraInicio, latitudeInicio, longitudeInicio, dataHoraTermino, latitudeTermino, longitudeTermino } = req.body;

  if (req.params.id != id) {
    return await ctrl.gerarRetornoErro(res);
  }

  const monitoramento = await dao.findById(id);

  if (!monitoramento) {
    return await ctrl.gerarRetornoErro(res, 'Monitoramento não encontrado.');
  }

  const flagRealizado = dataHoraTermino != null;

  await dao.atualizar(id, flagRealizado, dataHoraInicio, latitudeInicio, longitudeInicio, dataHoraTermino, latitudeTermino, longitudeTermino, req.idUnidadeEscolar, req.idPrestadorServico);
  await ctrl.gerarRetornoOk(res, null, 'Monitoramento salvo com sucesso.');

}

exports.atualizarTodos = async (req, res) => {

  const monitoramentoList = req.body.monitoramentoList;
  const _transaction = await ctrl.iniciarTransaction();

  try {

    for (const monitoramento of monitoramentoList) {

      await dao.atualizar(
        monitoramento.id,
        (monitoramento.dataHoraTermino != null),
        monitoramento.dataHoraInicio,
        monitoramento.latitudeInicio,
        monitoramento.longitudeInicio,
        monitoramento.dataHoraTermino,
        monitoramento.latitudeTermino,
        monitoramento.longitudeTermino,
        req.idUnidadeEscolar,
        req.idPrestadorServico,
        _transaction
      );

    }

    await ctrl.finalizarTransaction(true, _transaction);
    await ctrl.gerarRetornoOk(res, `${monitoramentoList.length} monitoramentos salvos um sucesso.`);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    await ctrl.gerarRetornoErro(res, 'Houve um erro ao salvar os monitoramentos.');
  }

}