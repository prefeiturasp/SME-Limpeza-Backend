// Arrays para capturar instâncias criadas pelo service
const daoInstances = [];
const ueDaoInstances = [];

// Mock inline dos DAOs — impede executar os arquivos reais e captura as instâncias
jest.mock('../contrato-dao', () => {
    return jest.fn().mockImplementation(() => {
        const inst = {
            buscar: jest.fn(),
            buscarEquipe: jest.fn(),
            buscarReajustes: jest.fn(),
        };
        // guarda a instância para uso nos testes
        daoInstances.push(inst);
        return inst;
    });
});

jest.mock('../../unidade-escolar/unidade-escolar-dao', () => {
    return jest.fn().mockImplementation(() => {
        const inst = {
            buscarDetalhe: jest.fn(),
        };
        ueDaoInstances.push(inst);
        return inst;
    });
});

// Esses não são usados diretamente neste teste, mas mockado para evitar execuções reais
jest.mock('../../usuario/usuario/usuario-dao', () => {
    return jest.fn().mockImplementation(() => ({}));
});

jest.mock('../../cargo/cargo-dao', () => {
    return jest.fn().mockImplementation(() => ({}));
});

// Mock do rfr para retornar o ctrl e objetos neutros
jest.mock('rfr', () => {
    return (path) => {
        if (path === 'core/controller.js') return require('./__mocks__/core_controller');
        if (path === 'core/utils/csv.js') return {};
        if (path === 'core/utils/utils.js') return {};
        return {}; // neutro p/ evitar quebras em imports indiretos
    };
});

// Mock do controller core
const CtrlMock = {
    gerarRetornoErro: jest.fn(),
    gerarRetornoOk: jest.fn(),
};
jest.doMock('./__mocks__/core_controller', () => CtrlMock, { virtual: true });

let service;

describe('exports.buscar (contrato-service)', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        // limpa arrays de instâncias antes de cada teste
        daoInstances.length = 0;
        ueDaoInstances.length = 0;

        // Carrega o service REAL somente após configurar os mocks
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

        if (daoInstances[0]) {
            expect(daoInstances[0].buscar).not.toHaveBeenCalled();
        }
    });

    it('deve buscar contrato, detalhar unidades, ordenar e retornar ok', async () => {
        req.params.id = 123;

        // Recupera a instância realmente usada pelo service:
        const daoInst = daoInstances[0];
        const ueDaoInst = ueDaoInstances[0];

        // Garante que as instâncias existam
        expect(daoInst).toBeDefined();
        expect(ueDaoInst).toBeDefined();

        // Configura os retornos esperados
        daoInst.buscar.mockResolvedValue({
            idContrato: 123,
            unidadeEscolarLista: [
                { idUnidadeEscolar: 20, dataInicial: '2024-01-01', dataFinal: '2024-12-31', valor: 200 },
                { idUnidadeEscolar: 10, dataInicial: '2024-02-01', dataFinal: '2024-12-31', valor: 100 },
            ],
        });

        ueDaoInst.buscarDetalhe
            .mockResolvedValueOnce({ idUnidadeEscolar: 20, descricao: 'Zeta' })
            .mockResolvedValueOnce({ idUnidadeEscolar: 10, descricao: 'Alpha' });

        daoInst.buscarEquipe
            .mockResolvedValueOnce([{ id: 1, nome: 'Equipe 1' }])
            .mockResolvedValueOnce([{ id: 2, nome: 'Equipe 2' }]);

        daoInst.buscarReajustes.mockResolvedValue([
            { idContratoReajuste: 1, dataInicial: '2024-06-01', percentual: 5 },
        ]);

        await service.buscar(req, res);

        expect(daoInst.buscar).toHaveBeenCalledWith(123);
        expect(ueDaoInst.buscarDetalhe).toHaveBeenCalledTimes(2);
        expect(ueDaoInst.buscarDetalhe).toHaveBeenNthCalledWith(1, 20);
        expect(ueDaoInst.buscarDetalhe).toHaveBeenNthCalledWith(2, 10);

        expect(daoInst.buscarEquipe).toHaveBeenCalledTimes(2);
        expect(daoInst.buscarEquipe).toHaveBeenNthCalledWith(1, 123, 20);
        expect(daoInst.buscarEquipe).toHaveBeenNthCalledWith(2, 123, 10);

        expect(daoInst.buscarReajustes).toHaveBeenCalledWith(123);

        expect(CtrlMock.gerarRetornoOk).toHaveBeenCalledTimes(1);
        const retornoContrato = CtrlMock.gerarRetornoOk.mock.calls[0][1];

        expect(retornoContrato.unidadeEscolarLista.map(u => u.descricao)).toEqual(['Alpha', 'Zeta']);

        expect(retornoContrato.unidadeEscolarLista[0]).toMatchObject({
            idUnidadeEscolar: 10,
            descricao: 'Alpha',
            dataInicial: '2024-02-01',
            dataFinal: '2024-12-31',
            valor: 100,
            equipeLista: [{ id: 2, nome: 'Equipe 2' }],
        });

        expect(retornoContrato.unidadeEscolarLista[1]).toMatchObject({
            idUnidadeEscolar: 20,
            descricao: 'Zeta',
            dataInicial: '2024-01-01',
            dataFinal: '2024-12-31',
            valor: 200,
            equipeLista: [{ id: 1, nome: 'Equipe 1' }],
        });

        expect(retornoContrato.reajusteLista).toEqual([
            { idContratoReajuste: 1, dataInicial: '2024-06-01', percentual: 5 },
        ]);
    });
});