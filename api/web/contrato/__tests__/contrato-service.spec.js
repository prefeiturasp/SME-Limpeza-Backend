// Arrays para capturar instâncias criadas pelo service
const daoInstances = [];
const ueDaoInstances = [];
const usuarioDaoInstances = [];

// Mock inline dos DAOs — captura instâncias
jest.mock('../contrato-dao', () => {
    return jest.fn().mockImplementation(() => {
        const inst = {
            buscar: jest.fn(),
            buscarEquipe: jest.fn(),
            buscarReajustes: jest.fn(),
            buscarVencimentoProximo: jest.fn(),
            datatable: jest.fn(),
            comboTodos: jest.fn(),
            insert: jest.fn(),
            insertUnidadeEscolar: jest.fn(),
            insertEquipe: jest.fn(),
            insertReajuste: jest.fn(),
            atualizar: jest.fn(),
            removerUnidadesEscolares: jest.fn(),
            removerEquipes: jest.fn(),
            removerReajustes: jest.fn(),
            removerUsuariosSME: jest.fn(),
            remover: jest.fn()
        };
        daoInstances.push(inst);
        return inst;
    });
});

jest.mock('../../unidade-escolar/unidade-escolar-dao', () => {
    return jest.fn().mockImplementation(() => {
        const inst = {
            buscarDetalhe: jest.fn(),
            buscarContrato: jest.fn(),
            findById: jest.fn(),
            buscarPorCodigo: jest.fn(),
            atualizarStatusNoContrato: jest.fn()
        };
        ueDaoInstances.push(inst);
        return inst;
    });
});

// Mock DO USUARIO DAO COM CAPTURA DE INSTÂNCIA
jest.mock('../../usuario/usuario/usuario-dao', () => {
    return jest.fn().mockImplementation(() => {
        const inst = {
            insertGestorPrestadorUnidadeEscolar: jest.fn(),
            removerPrestadorUnidadeEscolarSemContrato: jest.fn(),
            comboContratoPorUsuarioSME: jest.fn()
        };
        usuarioDaoInstances.push(inst);
        return inst;
    });
});

// Mock do cargoDao apenas para evitar execuções reais
jest.mock('../../cargo/cargo-dao', () => {
    return jest.fn().mockImplementation(() => ({}));
});

// Mock do rfr
jest.mock('rfr', () => {
    return (path) => {
        if (path === 'core/controller.js') return require('./__mocks__/core_controller');
        if (path === 'core/utils/csv.js') return {};
        if (path === 'core/utils/utils.js') return {
            parseDate: (v) => new Date(v),
            parseNumberCsv: (v) => Number(v)
        };
        return {};
    };
});

// Mock do controller core
const CtrlMock = {
    gerarRetornoErro: jest.fn(),
    gerarRetornoOk: jest.fn(),
    gerarRetornoDatatable: jest.fn(),
    iniciarTransaction: jest.fn().mockResolvedValue('tx'),
    finalizarTransaction: jest.fn().mockResolvedValue()
};
jest.doMock('./__mocks__/core_controller', () => CtrlMock, { virtual: true });

let service;

describe('exports.buscar (contrato-service)', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        daoInstances.length = 0;
        ueDaoInstances.length = 0;
        usuarioDaoInstances.length = 0;

        jest.isolateModules(() => {
            service = require('../contrato-service');
        });

        req = { params: {}, query: {}, body: {}, userData: {} };
        res = {};
    });

    it('deve retornar erro se id não for informado', async () => {
        await service.buscar(req, res);

        expect(CtrlMock.gerarRetornoErro).toHaveBeenCalledTimes(1);
        expect(CtrlMock.gerarRetornoOk).not.toHaveBeenCalled();
    });

    it('deve buscar contrato, detalhar unidades, ordenar e retornar ok', async () => {
        req.params.id = 123;

        const daoInst = daoInstances[0];
        const ueDaoInst = ueDaoInstances[0];

        expect(daoInst).toBeDefined();
        expect(ueDaoInst).toBeDefined();

        daoInst.buscar.mockResolvedValue({
            idContrato: 123,
            unidadeEscolarLista: [
                { idUnidadeEscolar: 20, dataInicial: '2024-01-01', dataFinal: '2024-12-31', valor: 200 },
                { idUnidadeEscolar: 10, dataInicial: '2024-02-01', dataFinal: '2024-12-31', valor: 100 }
            ]
        });

        ueDaoInst.buscarDetalhe
            .mockResolvedValueOnce({ idUnidadeEscolar: 20, descricao: 'Zeta' })
            .mockResolvedValueOnce({ idUnidadeEscolar: 10, descricao: 'Alpha' });

        daoInst.buscarEquipe
            .mockResolvedValueOnce([{ id: 1, nome: 'Equipe 1' }])
            .mockResolvedValueOnce([{ id: 2, nome: 'Equipe 2' }]);

        daoInst.buscarReajustes.mockResolvedValue([
            { idContratoReajuste: 1, dataInicial: '2024-06-01', percentual: 5 }
        ]);

        await service.buscar(req, res);

        expect(CtrlMock.gerarRetornoOk).toHaveBeenCalledTimes(1);

        const retorno = CtrlMock.gerarRetornoOk.mock.calls[0][1];

        expect(retorno.unidadeEscolarLista.map(u => u.descricao)).toEqual(['Alpha', 'Zeta']);
    });
});

//
// -------------------------------------------------------------------------------------
// TESTE ATUALIZAR
// -------------------------------------------------------------------------------------
//

describe('exports.atualizar (contrato-service)', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        daoInstances.length = 0;
        ueDaoInstances.length = 0;
        usuarioDaoInstances.length = 0;

        jest.isolateModules(() => {
            service = require('../contrato-service');
        });

        req = { params: {}, body: {}, userData: {} };
        res = {};
    });

    it('deve atualizar contrato com sucesso (fluxo completo)', async () => {
        req.params.id = 10;
        req.body = {
            id: 10,
            descricao: 'Contrato X',
            codigo: 'C-10',
            nomeResponsavel: 'João',
            emailResponsavel: 'teste@x.com',
            idPrestadorServico: 99,
            valorTotal: '123.45',
            numeroPregao: 'PG123',
            nomeLote: 'Lote 1',
            modelo: 'A',

            unidadeEscolarLista: [
                {
                    id: 1,
                    codigo: 'UE01',
                    dataInicial: '2024-01-01',
                    dataFinal: '2024-12-31',
                    valor: 500,
                    idStatusUnidadeEscolar: 7,
                    motivoStatus: 'Ok',
                    equipeLista: [
                        { id: 50, quantidade: 2, valorMensal: 1000 }
                    ]
                }
            ],

            reajusteLista: [
                {
                    idContratoReajuste: null,
                    dataInicial: '2024-06-01',
                    percentual: 5,
                    flagAtivo: true
                }
            ]
        };

        const daoInst = daoInstances[0];
        const ueDaoInst = ueDaoInstances[0];
        const usuarioDaoInst = usuarioDaoInstances[0];

        expect(daoInst).toBeDefined();
        expect(ueDaoInst).toBeDefined();
        expect(usuarioDaoInst).toBeDefined();

        // mocks necessários
        ueDaoInst.buscarContrato.mockResolvedValueOnce(null);
        ueDaoInst.buscarContrato.mockResolvedValueOnce(null);

        daoInst.atualizar.mockResolvedValue();
        daoInst.removerUnidadesEscolares.mockResolvedValue();
        daoInst.removerEquipes.mockResolvedValue();
        daoInst.insertUnidadeEscolar.mockResolvedValue();
        daoInst.insertEquipe.mockResolvedValue();
        daoInst.insertReajuste.mockResolvedValue();

        usuarioDaoInst.insertGestorPrestadorUnidadeEscolar.mockResolvedValue();
        usuarioDaoInst.removerPrestadorUnidadeEscolarSemContrato.mockResolvedValue();

        ueDaoInst.atualizarStatusNoContrato.mockResolvedValue();

        // Executa
        await service.atualizar(req, res);

        expect(daoInst.atualizar).toHaveBeenCalledTimes(1);
        expect(daoInst.removerUnidadesEscolares).toHaveBeenCalledWith('tx', 10);
        expect(daoInst.removerEquipes).toHaveBeenCalledWith('tx', 10);

        expect(daoInst.insertUnidadeEscolar).toHaveBeenCalled();

        expect(daoInst.insertEquipe).toHaveBeenCalledWith(
            'tx',
            10,
            1,
            50,
            2,
            1000
        );

        expect(daoInst.insertReajuste).toHaveBeenCalledWith(
            'tx',
            10,
            '2024-06-01',
            5
        );

        expect(CtrlMock.gerarRetornoOk).toHaveBeenCalledTimes(1);
    });
});
