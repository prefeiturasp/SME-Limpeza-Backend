const ctrl = require('rfr')('core/controller.js');
const csv = require('rfr')('core/utils/csv.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./relatorio-equipe-contrato-dao');
const ContratoDao = require('../../contrato/contrato-dao');
const PrestadorServicoDao = require('../../prestador-servico/prestador-servico-dao');
const UsuarioDao = require('../../usuario/usuario/usuario-dao');

const dao = new Dao();
const contratoDao = new ContratoDao();
const prestadorServicoDao = new PrestadorServicoDao();
const usuarioDao = new UsuarioDao();

exports.tabela = async (req, res) => {

  const params = await utils.getDatatableParams(req);
  const idContratoPermissaoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const possuiPermissaoContratoFiltrado = (idContratoPermissaoList || []).some(c => c === params.filters.contrato?.id);
  const idContratoList = params.filters.contrato && possuiPermissaoContratoFiltrado ? [params.filters.contrato.id] : idContratoPermissaoList;
  const contratoList = await dao.datatable(params.filters.ano, params.filters.mes, idContratoList, params.length, params.start);

  for (const c of contratoList) {
    c.percentualAusencia = parseFloat(c.percentualAusencia);
    c.classePercentualAusencia = c.percentualAusencia >= 9 ? 'text-danger' : c.percentualAusencia >= 5 ? 'text-warning' : 'text-success';
  }

  await ctrl.gerarRetornoDatatable(res, contratoList);

}

exports.exportar = async (req, res) => {
  const { mes, ano } = req.query;
  const contrato = req.query.contrato ? JSON.parse(req.query.contrato) : null;
  const idContratoPermissaoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
  const possuiPermissaoContratoFiltrado = (idContratoPermissaoList || []).some(c => c === contrato?.id);
  const idContratoList = contrato && possuiPermissaoContratoFiltrado ? [contrato.id] : idContratoPermissaoList;
  const contratoList = await dao.exportar(ano, mes, idContratoList);
  const csvString = await csv.converterFromJson(contratoList);
  await ctrl.gerarRetornoOk(res, csvString);
}