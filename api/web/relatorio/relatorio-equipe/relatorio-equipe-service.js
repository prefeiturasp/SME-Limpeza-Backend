const ctrl = require('rfr')('core/controller.js');
const csv = require('rfr')('core/utils/csv.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./relatorio-equipe-dao');
const ContratoDao = require('../../contrato/contrato-dao');
const PrestadorServicoDao = require('../../prestador-servico/prestador-servico-dao');
const UsuarioDao = require('../../usuario/usuario/usuario-dao');

const dao = new Dao();
const contratoDao = new ContratoDao();
const prestadorServicoDao = new PrestadorServicoDao();
const usuarioDao = new UsuarioDao();

exports.tabela = async (req, res) => {

  const params = await utils.getDatatableParams(req);
  const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : params.filters.unidadeEscolar?.id;
  const idContratoPermissaoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const possuiPermissaoContratoFiltrado = (idContratoPermissaoList || []).some(c => c === params.filters.contrato?.id);
  const idContratoList = params.filters.contrato && possuiPermissaoContratoFiltrado ? [params.filters.contrato.id] : idContratoPermissaoList;
  const unidadeEscolarList = await dao.datatable(idUnidadeEscolar, params.filters.ano, params.filters.mes, params.length, params.start, idContratoList);

  for (const ue of unidadeEscolarList) {
    ue.percentualAusencia = parseFloat(ue.percentualAusencia);
    ue.percentualMulta = ue.percentualAusencia >= 9 ? 3 : ue.percentualAusencia >= 5 ? 2 : 0;
    ue.classePercentualAusencia = ue.percentualAusencia >= 9 ? 'text-danger' : ue.percentualAusencia >= 5 ? 'text-warning' : 'text-success';
  }

  await ctrl.gerarRetornoDatatable(res, unidadeEscolarList);

}

exports.exportar = async (req, res) => {
  const { mes, ano } = req.query;
  const unidadeEscolar = req.query.unidadeEscolar ? JSON.parse(req.query.unidadeEscolar) : null;
  const contrato = req.query.contrato ? JSON.parse(req.query.contrato) : null;
  const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : unidadeEscolar?.id;
  const idContratoPermissaoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const possuiPermissaoContratoFiltrado = (idContratoPermissaoList || []).some(c => c === contrato?.id);
  const idContratoList = contrato && possuiPermissaoContratoFiltrado ? [contrato.id] : idContratoPermissaoList;
  const unidadeEscolarList = await dao.exportar(idUnidadeEscolar, ano, mes, idContratoList);

  for (const ue of unidadeEscolarList) {
    ue.percentualAusencia = parseFloat(ue.percentualAusencia);
    ue.percentualMulta = ue.percentualAusencia >= 9 ? 3 : ue.percentualAusencia >= 5 ? 2 : 0;
  }

  const csvString = await csv.converterFromJson(unidadeEscolarList);
  await ctrl.gerarRetornoOk(res, csvString);
}