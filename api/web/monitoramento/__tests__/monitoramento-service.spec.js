const mockCtrl = {
    gerarRetornoDatatable: jest.fn(),
    gerarRetornoOk: jest.fn(),
    gerarRetornoErro: jest.fn(),
    verificarPodeFiscalizar: jest.fn(),
    enviarEmail: jest.fn(),
};
const mockUtils = { getDatatableParams: jest.fn() };
const mockUsuarioCargoConstants = { RESPONSAVEL_UE: 1 };

// Mapa fixo para o rfr. As chaves devem bater exatamente com os requires do service.
jest.mock('rfr', () => {
    const map = {
        'core/controller.js': mockCtrl,
        'core/utils/utils.js': mockUtils,
        'core/constants/usuario-cargo.constantes': mockUsuarioCargoConstants,
    };
    return (p) => {
        const mod = map[p];
        if (!mod) {
            throw new Error('rfr mock: módulo não registrado: ' + p);
        }
        return mod;
    };
});

// ========== Mocks dos DAOs com os caminhos EXATOS que o service usa ==========
let mockDaoDatatable = jest.fn();
let mockDaoDatatableDatasAgendamentoManual = jest.fn();
let mockDaoBuscar = jest.fn();
let mockDaoInserir = jest.fn();
let mockDaoAtualizarData = jest.fn();
let mockDaoRemover = jest.fn();

let mockComboContratoPorUsuarioSME = jest.fn();
let mockBuscarPrestadorPorUnidadeEscolar = jest.fn();

let mockUnidadeEscolarBuscarDetalhe = jest.fn();
let mockUnidadeEscolarBuscarPrestadorServicoAtual = jest.fn();

jest.mock('../monitoramento-dao', () => {
    return jest.fn().mockImplementation(() => ({
        datatable: (...args) => mockDaoDatatable(...args),
        datatableDatasAgendamentoManual: (...args) => mockDaoDatatableDatasAgendamentoManual(...args),
        buscar: (...args) => mockDaoBuscar(...args),
        inserir: (...args) => mockDaoInserir(...args),
        atualizarData: (...args) => mockDaoAtualizarData(...args),
        remover: (...args) => mockDaoRemover(...args),
    }));
});

jest.mock('../../usuario/usuario/usuario-dao', () => {
    return jest.fn().mockImplementation(() => ({
        comboContratoPorUsuarioSME: (...args) => mockComboContratoPorUsuarioSME(...args),
        buscarPrestadorPorUnidadeEscolar: (...args) => mockBuscarPrestadorPorUnidadeEscolar(...args),
    }));
});

jest.mock('../../unidade-escolar/unidade-escolar-dao', () => {
    return jest.fn().mockImplementation(() => ({
        buscarDetalhe: (...args) => mockUnidadeEscolarBuscarDetalhe(...args),
        buscarPrestadorServicoAtual: (...args) => mockUnidadeEscolarBuscarPrestadorServicoAtual(...args),
    }));
});

describe('monitoramento-service.tabela()', () => {
    let service;
    let req;
    let res;

    const buildReq = (overrides = {}) => ({
        userData: {
            idUsuario: 123,
            origem: { codigo: 'sme' }, // padrão SME
            idOrigemDetalhe: null,
        },
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Recria funções mock globais
        mockCtrl.gerarRetornoDatatable.mockReset();
        mockCtrl.gerarRetornoOk.mockReset();
        mockCtrl.gerarRetornoErro.mockReset();
        mockCtrl.verificarPodeFiscalizar.mockReset();
        mockCtrl.enviarEmail.mockReset();

        mockUtils.getDatatableParams.mockReset();

        mockDaoDatatable = jest.fn();
        mockDaoDatatableDatasAgendamentoManual = jest.fn();
        mockDaoBuscar = jest.fn();
        mockDaoInserir = jest.fn();
        mockDaoAtualizarData = jest.fn();
        mockDaoRemover = jest.fn();

        mockComboContratoPorUsuarioSME = jest.fn();
        mockBuscarPrestadorPorUnidadeEscolar = jest.fn();

        mockUnidadeEscolarBuscarDetalhe = jest.fn();
        mockUnidadeEscolarBuscarPrestadorServicoAtual = jest.fn();

        // Importa o módulo sob teste após mocks
        service = require('../monitoramento-service');

        req = buildReq();
        res = {};
    });

    test('SME: normaliza filters.datas e chama dao.datatable com args corretos', async () => {
        mockUtils.getDatatableParams.mockResolvedValue({
            length: 10,
            start: 0,
            filters: {
                datas: ['2025-01-10', '11/01/2025', 'invalid'],
                unidadeEscolar: { id: 777 }, // para SME, vai como 777
                prestadorServico: { id: 555 }, // para SME, vai como 555 (ehPrestadorServico = false)
                idAmbienteUnidadeEscolar: 42,
            },
        });
        mockComboContratoPorUsuarioSME.mockResolvedValue([{ id: 1 }, { id: 2 }]);

        const tabelaMock = { data: [], recordsTotal: 0, recordsFiltered: 0 };
        mockDaoDatatable.mockResolvedValue(tabelaMock);

        await service.tabela(req, res);

        expect(mockUtils.getDatatableParams).toHaveBeenCalledWith(req);
        expect(mockComboContratoPorUsuarioSME).toHaveBeenCalledWith(123);

        expect(mockDaoDatatable).toHaveBeenCalledTimes(1);
        expect(mockDaoDatatable).toHaveBeenCalledWith(
            123,                               // idUsuario
            false,                             // ehPrestadorServico
            555,                               // idPrestadorServico (do filtro, pois não é PS)
            777,                               // idUnidadeEscolar (do filtro, pois não é UE)
            ['2025-01-10', '2025-01-11'],      // datasList normalizada
            42,                                // idAmbienteUnidadeEscolar
            [1, 2],                            // idContratoList
            null,                              // idDiretoriaRegional
            10,                                // length
            0                                  // start
        );
        expect(mockCtrl.gerarRetornoDatatable).toHaveBeenCalledWith(res, tabelaMock);
    });

    test('SME: aceita filters.data quando não houver filters.datas (datasList = null)', async () => {
        mockUtils.getDatatableParams.mockResolvedValue({
            length: 25,
            start: 50,
            filters: {
                data: '15/02/2025',
                idAmbienteUnidadeEscolar: null,
            },
        });
        mockComboContratoPorUsuarioSME.mockResolvedValue([]);

        mockDaoDatatable.mockResolvedValue({ data: ['ok'] });

        await service.tabela(req, res);

        expect(mockDaoDatatable).toHaveBeenCalledWith(
            123,
            false,
            null,
            null,
            null, // datasList
            null,
            [],
            null,
            25,
            50
        );
        expect(mockCtrl.gerarRetornoDatatable).toHaveBeenCalled();
    });

    test('perfil ps: envia idPrestadorServico do userData e ignora filtro prestadorServico', async () => {
        req.userData.origem.codigo = 'ps';
        req.userData.idOrigemDetalhe = 999;

        mockUtils.getDatatableParams.mockResolvedValue({
            length: 5,
            start: 0,
            filters: {
                datas: [],
                prestadorServico: { id: 111 }, // ignorado pois PS
            },
        });

        mockDaoDatatable.mockResolvedValue({});

        await service.tabela(req, res);

        expect(mockDaoDatatable).toHaveBeenCalledWith(
            123,
            true,   // ehPrestadorServico
            999,    // idPrestadorServico
            null,
            null,
            null,
            null,   // idContratoList (não SME)
            null,   // idDiretoriaRegional
            5,
            0
        );
    });

    test('perfil dre: envia idDiretoriaRegional do userData', async () => {
        req.userData.origem.codigo = 'dre';
        req.userData.idOrigemDetalhe = 222;

        mockUtils.getDatatableParams.mockResolvedValue({
            length: 10,
            start: 0,
            filters: { datas: ['2025-03-10'] },
        });

        mockDaoDatatable.mockResolvedValue({});

        await service.tabela(req, res);

        expect(mockDaoDatatable).toHaveBeenCalledWith(
            123,
            false,
            null,
            null,
            ['2025-03-10'],
            null,   // idAmbienteUnidadeEscolar: service usa "|| null"
            null,   // idContratoList: não SME
            222,    // idDiretoriaRegional
            10,
            0
        );
    });

    test('perfil ue: envia idUnidadeEscolar do userData e ignora filtro unidadeEscolar', async () => {
        req.userData.origem.codigo = 'ue';
        req.userData.idOrigemDetalhe = 333;

        mockUtils.getDatatableParams.mockResolvedValue({
            length: 10,
            start: 0,
            filters: { unidadeEscolar: { id: 444 }, datas: null },
        });

        mockDaoDatatable.mockResolvedValue({});

        await service.tabela(req, res);

        expect(mockDaoDatatable).toHaveBeenCalledWith(
            123,
            false,
            null,
            333,  // idUnidadeEscolar do usuário
            null,
            null, // idAmbienteUnidadeEscolar: "|| null"
            null,
            null,
            10,
            0
        );
    });

    test('erro: chama gerarRetornoErro', async () => {
        mockUtils.getDatatableParams.mockRejectedValue(new Error('boom'));

        await service.tabela(req, res);

        expect(mockCtrl.gerarRetornoErro).toHaveBeenCalledWith(res);
    });
});