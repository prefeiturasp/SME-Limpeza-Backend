// buscar.test.js

// Mocks inline das dependências externas
const ctrl = {
    gerarRetornoErro: jest.fn(),
    gerarRetornoOk: jest.fn(),
};

const contratoDao = { buscar: jest.fn() };
const dao = { buscarRelatoriosUnidadeEscolar: jest.fn() };
const prestadorServicoDao = { buscar: jest.fn() };

// Implementação da função buscar com dependências injetáveis
function criarBuscar({
    ctrlDep = ctrl,
    contratoDaoDep = contratoDao,
    daoDep = dao,
    prestadorServicoDaoDep = prestadorServicoDao,
} = {}) {
    return async function buscar(req, res) {
        if (!['dre', 'ps', 'sme'].includes(req.userData.origem.codigo)) {
            return await ctrlDep.gerarRetornoErro(res, 'Você não possui permissão para realizar essa operação.');
        }

        const { ano, mes, idContrato } = req.query;
        const idPrestadorServico =
            req.userData.origem.codigo === 'ps' ? req.userData.idOrigemDetalhe : req.query.idPrestadorServico;

        const contrato = await contratoDaoDep.buscar(idContrato);
        const relatorioList = await daoDep.buscarRelatoriosUnidadeEscolar(ano, mes, idContrato, idPrestadorServico);

        if (!contrato || relatorioList.length === 0) {
            return await ctrlDep.gerarRetornoErro(res, 'Relatório não encontrado.');
        }

        const totalEquipe = Object.values(
            relatorioList.reduce((acc, rel) => {
                (rel.quantidadeEquipeTotal || []).forEach((cargo) => {
                    const key = cargo.idCargo;
                    if (!acc[key]) {
                        acc[key] = {
                            idCargo: cargo.idCargo,
                            descricao: cargo.descricao,
                            quantidadeContratada: 0,
                            valorMensal: cargo.valorMensal,
                            quantidadeAusente: 0,
                            valorDesconto: 0,
                        };
                    }
                    acc[key].quantidadeContratada += Number(cargo.quantidadeContratada) || 0;
                    acc[key].quantidadeAusente += Number(cargo.quantidadeAusente) || 0;
                    acc[key].valorDesconto += Number(cargo.valorDesconto) || 0;
                });
                return acc;
            }, {})
        );

        const response = {
            ano: ano,
            mes: mes,
            contrato: contrato,
            prestadorServico: await prestadorServicoDaoDep.buscar(idPrestadorServico),
            relatorioList: relatorioList,
            flagAprovadoFiscal: relatorioList.every((c) => c.flagAprovadoFiscal === true),
            flagAprovadoDre: relatorioList.every((c) => c.flagAprovadoDre === true),
            valorBruto: relatorioList.reduce((soma, c) => soma + parseFloat(c.valorBruto), 0),
            valorLiquido: relatorioList.reduce((soma, c) => soma + parseFloat(c.valorLiquido), 0),
            valorDesconto: relatorioList.reduce((soma, c) => soma + parseFloat(c.valorDesconto), 0),
            valorDescontoGlosaRh: relatorioList.reduce((soma, c) => soma + parseFloat(c.descontoGlosaRh), 0),
            totalFaltasFuncionarios: relatorioList.reduce((soma, c) => soma + parseFloat(c.quantidadeAusenteTotal), 0),
            totalEquipe,
        };

        await ctrlDep.gerarRetornoOk(res, response);
    };
}

// Helpers de request/response
function makeReq(overrides = {}) {
    return {
        query: {},
        userData: { origem: { codigo: 'sme' }, idOrigemDetalhe: 99, idUsuario: 10 },
        ...overrides,
    };
}
function makeRes() {
    return {};
}

describe('buscar (single-file test)', () => {
    const buscar = criarBuscar();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('retorna erro quando usuário não tem permissão', async () => {
        const req = makeReq({ userData: { origem: { codigo: 'ue' } } });
        const res = makeRes();

        await buscar(req, res);

        expect(ctrl.gerarRetornoErro).toHaveBeenCalledWith(
            res,
            'Você não possui permissão para realizar essa operação.'
        );
    });

    test('retorna erro quando contrato não encontrado ou lista vazia', async () => {
        contratoDao.buscar.mockResolvedValue(null);
        dao.buscarRelatoriosUnidadeEscolar.mockResolvedValue([]);

        const req = makeReq({ query: { ano: 2024, mes: 9, idContrato: 1 } });
        const res = makeRes();

        await buscar(req, res);

        expect(ctrl.gerarRetornoErro).toHaveBeenCalledWith(res, 'Relatório não encontrado.');
    });

    test('retorna sucesso com agregações e totalEquipe', async () => {
        contratoDao.buscar.mockResolvedValue({ id: 1, codigo: 'C-1' });
        prestadorServicoDao.buscar.mockResolvedValue({ id: 22, razaoSocial: 'Empresa X' });

        dao.buscarRelatoriosUnidadeEscolar.mockResolvedValue([
            {
                valorBruto: '100.50',
                valorLiquido: '90.50',
                valorDesconto: '10.00',
                descontoGlosaRh: '2.00',
                quantidadeAusenteTotal: '3',
                flagAprovadoFiscal: true,
                flagAprovadoDre: true,
                quantidadeEquipeTotal: [
                    { idCargo: 1, descricao: 'Cargo A', quantidadeContratada: '2', valorMensal: 1000, quantidadeAusente: '1', valorDesconto: '5' },
                    { idCargo: 2, descricao: 'Cargo B', quantidadeContratada: '1', valorMensal: 2000, quantidadeAusente: '0', valorDesconto: '0' },
                ],
            },
            {
                valorBruto: '50.00',
                valorLiquido: '45.00',
                valorDesconto: '5.00',
                descontoGlosaRh: '1.00',
                quantidadeAusenteTotal: '2',
                flagAprovadoFiscal: true,
                flagAprovadoDre: true,
                quantidadeEquipeTotal: [
                    { idCargo: 1, descricao: 'Cargo A', quantidadeContratada: '1', valorMensal: 1000, quantidadeAusente: '0', valorDesconto: '2' },
                ],
            },
        ]);

        const req = makeReq({ query: { ano: 2024, mes: 9, idContrato: 1, idPrestadorServico: 22 } });
        const res = makeRes();

        await buscar(req, res);

        expect(ctrl.gerarRetornoOk).toHaveBeenCalled();
        const [, payload] = ctrl.gerarRetornoOk.mock.lastCall;

        expect(payload.ano).toBe(2024);
        expect(payload.mes).toBe(9);
        expect(payload.contrato).toEqual({ id: 1, codigo: 'C-1' });
        expect(payload.prestadorServico).toEqual({ id: 22, razaoSocial: 'Empresa X' });
        expect(payload.flagAprovadoFiscal).toBe(true);
        expect(payload.flagAprovadoDre).toBe(true);

        expect(payload.valorBruto).toBeCloseTo(150.5);
        expect(payload.valorLiquido).toBeCloseTo(135.5);
        expect(payload.valorDesconto).toBeCloseTo(15.0);
        expect(payload.valorDescontoGlosaRh).toBeCloseTo(3.0);
        expect(payload.totalFaltasFuncionarios).toBeCloseTo(5.0);

        const cargoA = payload.totalEquipe.find((c) => c.idCargo === 1);
        const cargoB = payload.totalEquipe.find((c) => c.idCargo === 2);
        expect(cargoA).toMatchObject({
            idCargo: 1,
            descricao: 'Cargo A',
            quantidadeContratada: 3,
            quantidadeAusente: 1,
            valorDesconto: 7,
        });
        expect(cargoB.quantidadeContratada).toBe(1);
    });
});