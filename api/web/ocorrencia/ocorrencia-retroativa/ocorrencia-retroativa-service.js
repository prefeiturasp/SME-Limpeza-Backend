const moment = require('moment');

const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./ocorrencia-retroativa-dao');
const UnidadeEscolarDao = require('../../unidade-escolar/unidade-escolar-dao');

const dao = new Dao();
const unidadeEscolarDao = new UnidadeEscolarDao();

exports.combo = combo;

async function combo(req, res) {

}

exports.comboUesPorIdContrato = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.comboTodasUesPorIdContrato(req.body.idContratoList));
}

exports.cadastrarOcorrenciaRetroativa = async (req, res) => {

  var promises = [];
  for (var i = 0; i < req.body.contratoList.length; i++) {
    var idContrato = req.body.contratoList[i];
    for (var j = 0; j < req.body.unidadeEscolarList.length; j++) {
      if(req.body.unidadeEscolarList[j].idContrato === idContrato){

        var dados = {
          idContrato: idContrato,
          idUnidadeEscolar: req.body.unidadeEscolarList[j].id,
          dataInicial: req.body.dataInicial,
          dataFinal: req.body.dataFinal,
          motivo: req.body.motivo,
          quantidadeOcorrencias: req.body.quantidadeOcorrencias
        };

        var idOcorrenciaRetroativa = await dao.cadastrarOcorrenciaRetroativa(dados, req.userData.idUsuario);
        promises.push(await dao.salvarOcorrenciasOcorrenciaRetroativa(idOcorrenciaRetroativa, req.body.quantidadeOcorrencias));
      }
    }
    const retorno = await Promise.all(promises);
    return await ctrl.gerarRetornoOk(res, retorno);
  }
  
}

exports.tabela = async (req, res) => {
  const params = await utils.getDatatableParams(req);
  const dataInicial = params.filters.dataInicial ? moment(params.filters.dataInicial).format('YYYY-MM-DD') : null;
  const dataFinal = params.filters.dataFinal ? moment(params.filters.dataFinal).format('YYYY-MM-DD') : null;
  const idContrato = params.filters.idContrato ? params.filters.idContrato.id : null;
  const idUnidadeEscolar = params.filters.idUnidadeEscolar ? params.filters.idUnidadeEscolar.id : null;
  const tabela = await dao.datatable(params, dataInicial, dataFinal, idContrato, idUnidadeEscolar);
  await ctrl.gerarRetornoDatatable(res, tabela);
}

exports.buscaDataOcorrenciaRetroativa = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.buscaDataOcorrenciaRetroativa(req.body.idUnidadeEscolar));
}

exports.buscaDetalhesOcorrenciaRetroativa = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.buscaDetalhesOcorrenciaRetroativa(req.body.idOcorrenciaRetroativa));
}

exports.buscaOcorrenciaRetroativaAbertaUE = async (req, res) => {
  return await ctrl.gerarRetornoOk(res, await dao.buscaOcorrenciaRetroativaAbertaUE(req.body.idsUnidadeEscolarList));
}

exports.removerOcorrenciaRetroativa = async (req, res) => {
  //busca os detalhes(informações) das ocorrencias retroativas
  const ocorrencias = await dao.buscaDetalhesOcorrenciaRetroativa(req.body.idOcorrenciaRetroativa);
  ocorrencias.forEach(async (ocorrencia) => {
    //remove as ocorrencias Vinculadas
    if(ocorrencia.idOcorrencia){
      await dao.removerOcorrenciaVinculada(ocorrencia.idOcorrencia);
    }
    //remove a quantidade de ocorrencias Retroativas
    await dao.removerOcorrenciaRetroativaOcorrencia(ocorrencia.idOcorrenciaRetroativaOcorrencia);
  });
  //remove a ocorrencia retroativa
  await dao.removerOcorrenciaRetroativa(req.body.idOcorrenciaRetroativa);
  return await ctrl.gerarRetornoOk(res);
}

exports.editarOcorrenciaRetroativa = async (req, res) => {

  const ocorrencias = await dao.buscaDetalhesOcorrenciaRetroativa(req.body.idOcorrenciaRetroativa);
  const qtdOcorrenciasPermitidasAnterior =  ocorrencias.length;
  var qtdOcorrencias = 0;

  if(req.body.quantidadeOcorrencias > qtdOcorrenciasPermitidasAnterior ){
    qtdOcorrencias = req.body.quantidadeOcorrencias - qtdOcorrenciasPermitidasAnterior;
    for (var i = 0; i < qtdOcorrencias; i++) {
      await dao.salvaOcorrenciaRetroativaOcorrencia(req.body.idOcorrenciaRetroativa);
    }

  } else if (qtdOcorrenciasPermitidasAnterior > req.body.quantidadeOcorrencias){
    qtdOcorrencias = qtdOcorrenciasPermitidasAnterior - req.body.quantidadeOcorrencias;
    for (var i = 0; i < qtdOcorrencias; i++) {
      const ultimoIdOcorrenciaRetroativaOcorrencia = await dao.buscaUltimoIdOcorrenciaRetroativaOcorrencia(req.body.idOcorrenciaRetroativa);
      //remove as ocorrencias Vinculadas
      if(ultimoIdOcorrenciaRetroativaOcorrencia.idOcorrencia){
        await dao.removerOcorrenciaVinculada(ultimoIdOcorrenciaRetroativaOcorrencia.idOcorrencia);
      }
      await dao.removerOcorrenciaRetroativaOcorrencia(ultimoIdOcorrenciaRetroativaOcorrencia.idOcorrenciaRetroativaOcorrencia);
    }
  }

  var dados = {
    idOcorrenciaRetroativa: req.body.idOcorrenciaRetroativa,
    dataInicial: req.body.dataInicial,
    dataFinal: req.body.dataFinal, 
    motivo: req.body.motivo,
    quantidadeOcorrencias: req.body.quantidadeOcorrencias
  };

  await dao.editarOcorrenciaRetroativa(dados);

  const arrVerificacao = [];
  const checagem = await dao.buscaDetalhesOcorrenciaRetroativa(req.body.idOcorrenciaRetroativa);

  checagem.forEach((ocorrencia) => {
    if(ocorrencia.idOcorrencia != null){
      arrVerificacao.push(true);
    } else {
      arrVerificacao.push(false);
    }
  });

  const allTrue = arrVerificacao.every(item => item === true);
  if(allTrue){
    await dao.finalizaOcorrenciaRetroativa(req.body.idOcorrenciaRetroativa);
  }

  return await ctrl.gerarRetornoOk(res);
  
}
