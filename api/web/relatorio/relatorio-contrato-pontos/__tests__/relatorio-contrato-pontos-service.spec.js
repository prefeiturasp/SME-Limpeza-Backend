jest.resetModules();

/**
 * rfr fake / registry — permite registrar módulos usados pelo service
 * e evita problemas com jest.mock factories acessando variáveis fora do escopo.
 */
jest.mock('rfr', () => {
  const registry = {};
  const rfr = (p) => {
    if (!(p in registry)) throw new Error(`rfr mock: módulo não registrado: ${p}`);
    return registry[p];
  };
  rfr.__set = (p, mod) => { registry[p] = mod; };
  return rfr;
});
const rfr = require('rfr');

/* -------------------------
   Mocks globais registrados
   ------------------------- */
const mockCtrl = {
  gerarRetornoDatatable: jest.fn().mockResolvedValue(undefined),
  gerarRetornoOk: jest.fn().mockResolvedValue(undefined),
  gerarRetornoErro: jest.fn().mockResolvedValue(undefined),
};
const mockUtils = { getDatatableParams: jest.fn() };
const mockCsv = { converterFromJson: jest.fn().mockResolvedValue('csv-result') };

rfr.__set('core/controller.js', mockCtrl);
rfr.__set('core/utils/utils.js', mockUtils);
rfr.__set('core/utils/csv.js', mockCsv);

/* -------------------------
   Mocks dos DAOs (mock* names)
   ------------------------- */
const mockBuscarRelatoriosFn = jest.fn();
const mockDatatableFn = jest.fn();
const mockDaoBuscarFn = jest.fn();

jest.mock('../relatorio-contrato-pontos-dao', () => {
  return jest.fn().mockImplementation(() => ({
    buscarRelatoriosUnidadeEscolar: (...args) => mockBuscarRelatoriosFn(...args),
    datatable: (...args) => mockDatatableFn(...args),
    buscar: (...args) => mockDaoBuscarFn(...args),
  }));
});

const mockContratoBuscarFn = jest.fn();
jest.mock('../../../contrato/contrato-dao', () => {
  return jest.fn().mockImplementation(() => ({
    buscar: (...args) => mockContratoBuscarFn(...args),
  }));
});

const mockPrestadorBuscarFn = jest.fn();
jest.mock('../../../prestador-servico/prestador-servico-dao', () => {
  return jest.fn().mockImplementation(() => ({
    buscar: (...args) => mockPrestadorBuscarFn(...args),
  }));
});

const mockUsuarioComboFn = jest.fn();
jest.mock('../../../usuario/usuario/usuario-dao', () => {
  return jest.fn().mockImplementation(() => ({
    comboContratoPorUsuarioSME: (...args) => mockUsuarioComboFn(...args),
  }));
});

/* -------------------------
   Requer o service (após mocks)
   ------------------------- */
const service = require('../relatorio-contrato-pontos-service');

describe('relatorio-contrato-pontos-service (combinado)', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /*************
   * buscar()
   *************/
  describe('buscar', () => {
    test('retorna ok com dados organizados quando tudo certo (anoReferencia string)', async () => {
      const req = {
        params: { idContrato: 1 },
        query: { anoReferencia: '2021,2020' },
        userData: { origem: { codigo: 'ps' }, idOrigemDetalhe: 10 }
      };
      const res = {};

      mockContratoBuscarFn.mockResolvedValue({ idPrestadorServico: 100, numeroPregao: 'NP', nomeLote: 'L' });
      mockBuscarRelatoriosFn.mockResolvedValue([
        { data: '2021/05', unidadeEscolar: { id: 1, codigo: 'UE1', tipo: 'T', descricao: 'U1' }, pontuacaoFinal: 10 },
        { data: '2020/04', unidadeEscolar: { id: 1, codigo: 'UE1', tipo: 'T', descricao: 'U1' }, pontuacaoFinal: 8 }
      ]);
      mockPrestadorBuscarFn.mockResolvedValue({ razaoSocial: 'Empresa X' });

      await service.buscar(req, res);

      expect(mockContratoBuscarFn).toHaveBeenCalledWith(1);
      expect(mockBuscarRelatoriosFn).toHaveBeenCalledWith(1, 10, [2021, 2020]);
      expect(mockPrestadorBuscarFn).toHaveBeenCalledWith(100);
      expect(mockCtrl.gerarRetornoOk).toHaveBeenCalled();

      const callArg = mockCtrl.gerarRetornoOk.mock.calls[0][1];
      expect(callArg.contrato).toBeDefined();
      expect(callArg.prestadorServico).toEqual({ razaoSocial: 'Empresa X' });
      expect(callArg.filtro).toEqual({ anoReferencia: [2021, 2020] });
      expect(callArg.anoMesList).toEqual(expect.arrayContaining(['2021/05', '2020/04']));
      expect(callArg.unidadeEscolarList).toHaveLength(1);
    });

    test('retorna erro quando contrato não existe ou relatorio vazio', async () => {
      const req = {
        params: { idContrato: 2 },
        query: {},
        userData: { origem: { codigo: 'ps' }, idOrigemDetalhe: 11 }
      };
      const res = {};

      mockContratoBuscarFn.mockResolvedValue(null);
      mockBuscarRelatoriosFn.mockResolvedValue([]);

      await service.buscar(req, res);

      expect(mockCtrl.gerarRetornoErro).toHaveBeenCalledWith(res, 'Relatório não encontrado.');
    });

    test('retorna erro quando origem não autorizada', async () => {
      const req = {
        params: { idContrato: 3 },
        query: {},
        userData: { origem: { codigo: 'other' }, idOrigemDetalhe: null }
      };
      const res = {};

      mockContratoBuscarFn.mockResolvedValue({ idPrestadorServico: 5 });
      mockBuscarRelatoriosFn.mockResolvedValue([{ data: '2021/01', unidadeEscolar: { id: 1 }, pontuacaoFinal: 1 }]);

      await service.buscar(req, res);

      expect(mockCtrl.gerarRetornoErro).toHaveBeenCalledWith(res, 'Relatório não encontrado.');
    });

    test('parsing de anoReferencia quando raw é number', async () => {
      const req = {
        params: { idContrato: 4 },
        query: { anoReferencia: 2022 },
        userData: { origem: { codigo: 'ps' }, idOrigemDetalhe: 12 }
      };
      const res = {};

      mockContratoBuscarFn.mockResolvedValue({ idPrestadorServico: 7 });
      mockBuscarRelatoriosFn.mockResolvedValue([{ data: '2022/01', unidadeEscolar: { id: 2 }, pontuacaoFinal: 5 }]);
      mockPrestadorBuscarFn.mockResolvedValue({ razaoSocial: 'Empresa Y' });

      await service.buscar(req, res);

      expect(mockBuscarRelatoriosFn).toHaveBeenCalledWith(4, 12, [2022]);
      expect(mockCtrl.gerarRetornoOk).toHaveBeenCalled();
    });
  });

  /*************
   * exportar()
   *************/
  describe('exportar', () => {
    test('exporta CSV e retorna ok', async () => {
      const req = {
        params: { idContrato: 10 },
        userData: { origem: { codigo: 'dre' }, idOrigemDetalhe: null }
      };
      const res = {};

      mockContratoBuscarFn.mockResolvedValue({ idPrestadorServico: 20, numeroPregao: 'NP', nomeLote: 'L', codigo: 'C1' });
      mockPrestadorBuscarFn.mockResolvedValue({ razaoSocial: 'Empresa Z' });
      mockBuscarRelatoriosFn.mockResolvedValue([
        { data: '2021/01', unidadeEscolar: { id: 1, codigo: 'UE1', tipo: 'T', descricao: 'U1' }, pontuacaoFinal: 7 }
      ]);

      await service.exportar(req, res);

      expect(mockContratoBuscarFn).toHaveBeenCalledWith(10);
      expect(mockCsv.converterFromJson).toHaveBeenCalled();
      expect(mockCtrl.gerarRetornoOk).toHaveBeenCalledWith(res, 'csv-result');
    });

    test('exportar - comportamento atual: contrato nulo provoca TypeError (acessa contrato.idPrestadorServico antes do check)', async () => {
      const req = {
        params: { idContrato: 11 },
        userData: { origem: { codigo: 'dre' }, idOrigemDetalhe: null }
      };
      const res = {};

      // contrato nulo provoca TypeError no código atual (veja nota)
      mockContratoBuscarFn.mockResolvedValue(null);
      mockBuscarRelatoriosFn.mockResolvedValue([]);

      await expect(service.exportar(req, res)).rejects.toThrow(TypeError);
    });

    test('exportar retorna erro quando origem nao permitida', async () => {
      const req = {
        params: { idContrato: 12 },
        userData: { origem: { codigo: 'other' }, idOrigemDetalhe: null }
      };
      const res = {};

      mockContratoBuscarFn.mockResolvedValue({ idPrestadorServico: 1 });
      mockBuscarRelatoriosFn.mockResolvedValue([{ data: '2021/01', unidadeEscolar: { id: 1 }, pontuacaoFinal: 7 }]);

      await service.exportar(req, res);

      expect(mockCtrl.gerarRetornoErro).toHaveBeenCalledWith(res, 'Relatório não encontrado.');
    });
  });

  /*************
   * tabela()
   *************/
  describe('tabela', () => {
    beforeEach(() => { });

    test('SME sem filtro de contrato: usa idContratoPermissaoList completo e converte anoReferencia', async () => {
      const req = {
        userData: { origem: { codigo: 'sme' }, idOrigemDetalhe: 999, idUsuario: 123 }
      };
      const res = {};

      mockUsuarioComboFn.mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }]);
      mockUtils.getDatatableParams.mockResolvedValue({
        filters: { anoReferencia: ['2023', '2024', 'abc', 2025.5] },
        length: 25,
        start: 0,
      });

      const tabelaResult = { data: [], recordsTotal: 0, recordsFiltered: 0 };
      mockDatatableFn.mockResolvedValue(tabelaResult);

      await service.tabela(req, res);

      expect(mockDatatableFn).toHaveBeenCalledTimes(1);
      expect(mockDatatableFn).toHaveBeenCalledWith(
        undefined,        // idPrestadorServico (não ps, sem filtro)
        undefined,        // idUnidadeEscolar (não ue, sem filtro)
        [10, 11, 12],     // idContratoList = toda permissão
        null,             // idDiretoriaRegional
        [2023, 2024],     // anoReferencia convertido e filtrado
        25,               // length
        0                 // start
      );
      expect(mockCtrl.gerarRetornoDatatable).toHaveBeenCalledWith(res, tabelaResult);
    });

    test('SME com filtro de contrato permitido: usa lista com único id do filtro', async () => {
      const req = {
        userData: { origem: { codigo: 'sme' }, idOrigemDetalhe: 999, idUsuario: 123 }
      };
      const res = {};

      mockUsuarioComboFn.mockResolvedValue([{ id: 5 }, { id: 6 }]);
      mockUtils.getDatatableParams.mockResolvedValue({
        filters: { contrato: { id: 6 }, anoReferencia: [2022] },
        length: 10,
        start: 20,
      });

      mockDatatableFn.mockResolvedValue({ ok: true });

      await service.tabela(req, res);

      expect(mockDatatableFn).toHaveBeenCalledWith(
        undefined,  // idPrestadorServico
        undefined,  // idUnidadeEscolar
        [6],        // permitido e filtrado
        null,
        [2022],
        10,
        20
      );
      expect(mockCtrl.gerarRetornoDatatable).toHaveBeenCalled();
    });

    test('SME com filtro de contrato NÃO permitido: usa lista completa de permissão', async () => {
      const req = {
        userData: { origem: { codigo: 'sme' }, idOrigemDetalhe: 999, idUsuario: 123 }
      };
      const res = {};

      mockUsuarioComboFn.mockResolvedValue([{ id: 5 }, { id: 6 }]);
      mockUtils.getDatatableParams.mockResolvedValue({
        filters: { contrato: { id: 99 }, anoReferencia: null },
        length: 50,
        start: 5,
      });

      mockDatatableFn.mockResolvedValue({ ok: true });

      await service.tabela(req, res);

      expect(mockDatatableFn).toHaveBeenCalledWith(
        undefined,  // idPrestadorServico
        undefined,  // idUnidadeEscolar
        [5, 6],     // toda a permissão
        null,
        null,       // anoReferencia null
        50,
        5
      );
    });

    test('perfil ps: usa idPrestadorServico do userData e ignora filtro prestadorServico', async () => {
      const req = {
        userData: { origem: { codigo: 'ps' }, idOrigemDetalhe: 777, idUsuario: 1 }
      };
      const res = {};

      mockUtils.getDatatableParams.mockResolvedValue({
        filters: { prestadorServico: { id: 888 }, unidadeEscolar: null, contrato: null },
        length: 15,
        start: 3,
      });

      mockDatatableFn.mockResolvedValue({ ok: true });

      await service.tabela(req, res);

      expect(mockDatatableFn).toHaveBeenCalledWith(
        777,
        undefined,
        null,
        null,
        null,
        15,
        3
      );
    });

    test('perfil ue: usa idUnidadeEscolar do userData e ignora filtro unidadeEscolar', async () => {
      const req = {
        userData: { origem: { codigo: 'ue' }, idOrigemDetalhe: 321, idUsuario: 1 }
      };
      const res = {};

      mockUtils.getDatatableParams.mockResolvedValue({
        filters: { unidadeEscolar: { id: 999 }, contrato: null },
        length: 5,
        start: 0,
      });

      mockDatatableFn.mockResolvedValue({ ok: true });

      await service.tabela(req, res);

      expect(mockDatatableFn).toHaveBeenCalledWith(
        undefined,
        321,
        null,
        null,
        null,
        5,
        0
      );
    });

    test('perfil dre: define idDiretoriaRegional do userData', async () => {
      const req = {
        userData: { origem: { codigo: 'dre' }, idOrigemDetalhe: 42, idUsuario: 1 }
      };
      const res = {};

      mockUtils.getDatatableParams.mockResolvedValue({
        filters: { contrato: null },
        length: 100,
        start: 200,
      });

      mockDatatableFn.mockResolvedValue({ ok: true });

      await service.tabela(req, res);

      expect(mockDatatableFn).toHaveBeenCalledWith(
        undefined,
        undefined,
        null,
        42,
        null,
        100,
        200
      );
    });

    test('anoReferencia ausente ou vazio: passa null', async () => {
      const req = {
        userData: { origem: { codigo: 'sme' }, idOrigemDetalhe: 999, idUsuario: 1 }
      };
      const res = {};

      mockUsuarioComboFn.mockResolvedValue([{ id: 1 }]);
      mockUtils.getDatatableParams.mockResolvedValue({
        filters: { anoReferencia: [] },
        length: 10,
        start: 0,
      });

      mockDatatableFn.mockResolvedValue({ ok: true });

      await service.tabela(req, res);

      // 5º argumento de datatable() é anoReferencia
      expect(mockDatatableFn.mock.calls[0][4]).toBeNull();
    });
  });

  /*************
   * anos()
   *************/
  describe('anos', () => {
    test('retorna anos ordenados decrescentemente', async () => {
      const req = {
        params: { idContrato: 33 },
        userData: { origem: { codigo: 'dre' }, idOrigemDetalhe: null }
      };
      const res = {};

      mockContratoBuscarFn.mockResolvedValue({ idPrestadorServico: 2 });
      mockBuscarRelatoriosFn.mockResolvedValue([
        { data: '2021/05' },
        { data: '2019/01' },
        { data: '2020/12' },
        { data: 'invalid' },
        { data: null }
      ]);

      await service.anos(req, res);

      expect(mockCtrl.gerarRetornoOk).toHaveBeenCalledWith(res, [2021, 2020, 2019]);
    });

    test('anos retorna erro quando origem nao permitida', async () => {
      const req = {
        params: { idContrato: 34 },
        userData: { origem: { codigo: 'other' }, idOrigemDetalhe: null }
      };
      const res = {};

      await service.anos(req, res);

      expect(mockCtrl.gerarRetornoErro).toHaveBeenCalledWith(res, 'Relatório não encontrado.');
    });

    test('anos retorna array vazio quando relatorioList vazio', async () => {
      const req = {
        params: { idContrato: 35 },
        userData: { origem: { codigo: 'dre' }, idOrigemDetalhe: null }
      };
      const res = {};

      mockContratoBuscarFn.mockResolvedValue({ idPrestadorServico: 2 });
      mockBuscarRelatoriosFn.mockResolvedValue([]);

      await service.anos(req, res);

      expect(mockCtrl.gerarRetornoOk).toHaveBeenCalledWith(res, []);
    });
  });

});
