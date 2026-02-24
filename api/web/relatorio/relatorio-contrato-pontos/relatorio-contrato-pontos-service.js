const ctrl = require('rfr')('core/controller.js');
const csv = require('rfr')('core/utils/csv.js');
const utils = require('rfr')('core/utils/utils.js');

const Dao = require('./relatorio-contrato-pontos-dao');
const ContratoDao = require('../../contrato/contrato-dao');
const PrestadorServicoDao = require('../../prestador-servico/prestador-servico-dao');
const DaoUsuario = require('../../usuario/usuario/usuario-dao');

const dao = new Dao();
const contratoDao = new ContratoDao();
const prestadorServicoDao = new PrestadorServicoDao();
const usuarioDao = new DaoUsuario();

exports.buscar = buscar;
exports.exportar = exportar;
exports.tabela = tabela;
exports.anos = anos;

async function buscar(req, res) {
    try {
        const idContrato = req.params.idContrato;

        const idPrestadorServico =
            req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : null;

        let anos = [];
        const raw = req.query.anoReferencia;

        if (raw != null) {
            if (Array.isArray(raw)) {
                anos = raw
                    .map(v => parseInt(String(v), 10))
                    .filter(n => Number.isInteger(n));
            } else if (typeof raw === 'string') {
                anos = raw
                    .split(',')
                    .map(v => parseInt(v.trim(), 10))
                    .filter(n => Number.isInteger(n));
            } else if (typeof raw === 'number') {
                anos = [raw];
            }
        }

        const contrato = await contratoDao.buscar(idContrato);
        const relatorioList = await dao.buscarRelatoriosUnidadeEscolar(
            idContrato,
            idPrestadorServico,
            anos
        );

        if (!contrato || relatorioList.length === 0) {
            return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
        }

        if (!['ps', 'dre', 'sme'].includes(req.userData.origem.codigo)) {
            return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
        }

        const dados = await organizaDados(relatorioList);

        const response = {
            contrato: contrato,
            prestadorServico: await prestadorServicoDao.buscar(contrato.idPrestadorServico),
            anoMesList: dados.anoMesList,
            unidadeEscolarList: dados.unidadeEscolarList,
            filtro: { anoReferencia: anos }
        };

        await ctrl.gerarRetornoOk(res, response);
    } catch (err) {
        console.error(err);
        await ctrl.gerarRetornoErro(res, 'Erro ao buscar relatório.');
    }
}

async function exportar(req, res) {

    const idContrato = req.params.idContrato;
    const idPrestadorServico = req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : null;

    const contrato = await contratoDao.buscar(idContrato);
    const prestadorServico = await prestadorServicoDao.buscar(contrato.idPrestadorServico);
    const relatorioList = await dao.buscarRelatoriosUnidadeEscolar(idContrato, idPrestadorServico);

    if (!contrato || relatorioList.length == 0) {
        return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
    }

    if (!['ps', 'dre', 'sme'].includes(req.userData.origem.codigo)) {
        return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
    }

    const dados = await organizaDados(relatorioList);

    const objtoExportacao = [];

    for (const ue of dados.unidadeEscolarList) {

        const linha = {
            numeroPregao: contrato.numeroPregao,
            nomeLote: contrato.nomeLote,
            termoContrato: contrato.codigo,
            nomeEmpresa: prestadorServico.razaoSocial,
            codigoUnidadeEscolar: ue.unidadeEscolar.codigo,
            tipoUnidadeEscolar: ue.unidadeEscolar.tipo,
            nomeUnidadeEscolar: ue.unidadeEscolar.descricao,
        };

        for (const anoMes of dados.anoMesList) {
            linha[anoMes] = ue.pontoList[anoMes] || ' - ';
        }

        objtoExportacao.push(linha);

    }

    const csvString = await csv.converterFromJson(objtoExportacao);
    await ctrl.gerarRetornoOk(res, csvString);

}

async function tabela(req, res) {
    const params = await utils.getDatatableParams(req);
    const idPrestadorServico = req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : params.filters.prestadorServico?.id;
    const idUnidadeEscolar = req.userData.origem.codigo === 'ue' ? req.userData.idOrigemDetalhe : params.filters.unidadeEscolar?.id;
    const idDiretoriaRegional = req.userData.origem.codigo === 'dre' ? req.userData.idOrigemDetalhe : null;
    const idContratoPermissaoList = req.userData.origem.codigo !== 'sme' ? null : (await usuarioDao.comboContratoPorUsuarioSME(req.userData.idUsuario)).map(c => c.id);
    const possuiPermissaoContratoFiltrado = (idContratoPermissaoList || []).some(c => c === params.filters.contrato?.id);
    const idContratoList = params.filters.contrato && possuiPermissaoContratoFiltrado ? [params.filters.contrato.id] : idContratoPermissaoList;
    const rawAnos = params.filters?.anoReferencia;
    const anoReferencia =
        Array.isArray(rawAnos) && rawAnos.length > 0
            ? rawAnos.map(a => Number(a)).filter(a => Number.isInteger(a))
            : null;

    const tabela = await dao.datatable(idPrestadorServico, idUnidadeEscolar, idContratoList, idDiretoriaRegional, anoReferencia, params.length, params.start);
    await ctrl.gerarRetornoDatatable(res, tabela);
}

async function anos(req, res) {
    try {
        const idContrato = req.params.idContrato;
        const idPrestadorServico =
            req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : null;

        if (!['ps', 'dre', 'sme'].includes(req.userData.origem.codigo)) {
            return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
        }

        const contrato = await contratoDao.buscar(idContrato);
        if (!contrato) {
            return await ctrl.gerarRetornoErro(res, 'Relatório não encontrado.');
        }

        const relatorioList = await dao.buscarRelatoriosUnidadeEscolar(
            idContrato,
            idPrestadorServico,
            null
        );

        if (!relatorioList || relatorioList.length === 0) {
            return await ctrl.gerarRetornoOk(res, []);
        }

        const anoSet = new Set();
        for (const item of relatorioList) {
            if (item?.data && typeof item.data === 'string') {
                const [yyyy] = item.data.split('/').map(Number);
                if (Number.isInteger(yyyy)) {
                    anoSet.add(yyyy);
                }
            }
        }

        const anos = Array.from(anoSet).sort((a, b) => b - a);
        await ctrl.gerarRetornoOk(res, anos);
    } catch (err) {
        console.error(err);
        await ctrl.gerarRetornoErro(res, 'Erro ao listar anos do contrato.');
    }
}

async function organizaDados(dados) {

    let anoMesList = [...new Set(dados.map((item) => item.data))];

    anoMesList.sort((a, b) => {
        const [anoA, mesA] = a.split('/').map(Number);
        const [anoB, mesB] = b.split('/').map(Number);

        if (anoA !== anoB) return anoB - anoA;
        return mesB - mesA;
    });

    const unidadeEscolarList = [];

    dados.forEach((item) => {

        let unidadeEncontrada = unidadeEscolarList.find(
            (unidade) => unidade.unidadeEscolar.id === item.unidadeEscolar.id
        );

        if (!unidadeEncontrada) {
            unidadeEncontrada = {
                unidadeEscolar: item.unidadeEscolar,
                pontoList: {}
            };
            unidadeEscolarList.push(unidadeEncontrada);
        }

        unidadeEncontrada.pontoList[item.data] = item.pontuacaoFinal;

    });

    unidadeEscolarList.forEach((ue) => {
        ue.pontoList = Object.fromEntries(
            Object.entries(ue.pontoList).sort((a, b) => {
                const [anoA, mesA] = a[0].split('/').map(Number);
                const [anoB, mesB] = b[0].split('/').map(Number);

                if (anoA !== anoB) return anoB - anoA;
                return mesB - mesA;
            })
        );
    });

    return {
        unidadeEscolarList,
        anoMesList
    };
}