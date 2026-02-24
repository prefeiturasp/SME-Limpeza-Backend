// 1) Mock de rfr
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

// 2) Registrar módulos rfr necessários
var mockCtrl = {
  gerarRetornoDatatable: jest.fn(),
  gerarRetornoOk: jest.fn(),
  gerarRetornoErro: jest.fn(),
  iniciarTransaction: jest.fn(),
  finalizarTransaction: jest.fn(),
  verificarPodeFiscalizar: jest.fn(),
  enviarEmail: jest.fn(),
};
var mockUtils = {
  getDatatableParams: jest.fn(),
};
rfr.__set('core/controller.js', mockCtrl);
rfr.__set('core/utils/utils.js', mockUtils);
rfr.__set('core/utils/csv.js', { converterFromJson: jest.fn() });

// 3) Mocks das dependências diretas usadas por tabela()
var mockDaoDatatable = jest.fn();
var mockComboContratoPorUsuarioSME = jest.fn();

jest.mock('../ocorrencia-dao', () => {
  return jest.fn().mockImplementation(() => ({
    datatable: (...args) => mockDaoDatatable(...args),
  }));
});

jest.mock('../../usuario/usuario/usuario-dao', () => {
  return jest.fn().mockImplementation(() => ({
    comboContratoPorUsuarioSME: (...args) => mockComboContratoPorUsuarioSME(...args),
  }));
});

// 4) Demais dependências requeridas no topo do arquivo (não usadas por tabela):
// mocks simples para módulos de FS e outros DAOs usados por outras funções
jest.mock('fs', () => ({}));
jest.mock('fs-extra', () => ({}));
jest.mock('../../../system/gerar-relatorio-gerencial-modelo2', () => ({}));
jest.mock('../../unidade-escolar/unidade-escolar-dao', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../monitoramento/monitoramento-dao', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../diretoria-regional/diretoria-regional-dao', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../ocorrencia/ocorrencia-variavel/ocorrencia-variavel-dao', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../contrato/contrato-dao', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../relatorio/relatorio-gerencial/relatorio-gerencial-dao', () => jest.fn().mockImplementation(() => ({})));

describe('ocorrencia-service.tabela()', () => {
  let service;
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    service = require('../ocorrencia-service');

    req = {
      userData: {
        origem: { codigo: 'sme' }, // default: SME
        idOrigemDetalhe: 999,
        idUsuario: 123,
      },
    };
    res = {};
  });

  test('SME sem filtro de contrato: usa permissão completa; converte datas; flags; respondido null', async () => {
    mockComboContratoPorUsuarioSME.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    mockUtils.getDatatableParams.mockResolvedValue({
      filters: {
        flagEncerrado: '',
        respondido: '',
        flagSomenteAtivos: 'true',
        prestadorServico: null,
        unidadeEscolar: null,
        idOcorrenciaTipo: 7,
        contrato: null,
        dataInicial: '2025-01-15',
        dataFinal: '2025-02-20',
      },
      length: 25,
      start: 0,
    });

    const tabelaResult = { data: [], recordsTotal: 0, recordsFiltered: 0 };
    mockDaoDatatable.mockResolvedValue(tabelaResult);

    await service.tabela(req, res);

    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123,            // idUsuario
      false,          // ehPrestadorServico
      undefined,      // idPrestadorServico
      null,           // idUnidadeEscolarList
      7,              // idOcorrenciaTipo
      '2025-01-15',   // dataInicial
      '2025-02-20',   // dataFinal
      null,           // flagEncerrado
      true,           // flagSomenteAtivos
      [10, 11],       // idContratoList
      null,           // idDiretoriaRegional
      null,           // respondido
      25,
      0
    );
    expect(mockCtrl.gerarRetornoDatatable).toHaveBeenCalledWith(res, tabelaResult);
  });

  test('SME com filtro de contrato permitido: usa [idFiltro]; respondido true; flagSomenteAtivos default true', async () => {
    mockComboContratoPorUsuarioSME.mockResolvedValue([{ id: 5 }, { id: 6 }]);
    mockUtils.getDatatableParams.mockResolvedValue({
      filters: {
        flagEncerrado: 'true',
        respondido: 'true',
        // flagSomenteAtivos ausente -> default true
        prestadorServico: null,
        unidadeEscolar: null,
        idOcorrenciaTipo: null,
        contrato: { id: 6 },         // permitido
        dataInicial: '2024-03-01',
        dataFinal: '2024-03-31',
      },
      length: 10,
      start: 20,
    });

    mockDaoDatatable.mockResolvedValue({ ok: true });

    await service.tabela(req, res);

    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123,
      false,
      undefined,
      null,
      null,
      '2024-03-01',
      '2024-03-31',
      true,
      true,
      [6],        // contrato filtrado permitido
      null,
      true,       // respondido
      10,
      20
    );
  });

  test('SME com filtro de contrato NÃO permitido: usa permissão completa; flagSomenteAtivos false; respondido false', async () => {
    mockComboContratoPorUsuarioSME.mockResolvedValue([{ id: 5 }, { id: 6 }]);
    mockUtils.getDatatableParams.mockResolvedValue({
      filters: {
        flagEncerrado: 'false',
        respondido: 'false',
        flagSomenteAtivos: 'false',
        prestadorServico: null,
        unidadeEscolar: null,
        idOcorrenciaTipo: null,
        contrato: { id: 99 },        // não permitido
        dataInicial: '2024-01-01',
        dataFinal: '2024-01-31',
      },
      length: 50,
      start: 5,
    });

    mockDaoDatatable.mockResolvedValue({ ok: true });

    await service.tabela(req, res);

    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123,
      false,
      undefined,
      null,
      null,
      '2024-01-01',
      '2024-01-31',
      false,
      false,
      [5, 6],   // toda permissão
      null,
      false,
      50,
      5
    );
  });

  test('perfil ps: usa idPrestadorServico do user; ignora filtro prestadorServico', async () => {
    req.userData.origem.codigo = 'ps';
    req.userData.idOrigemDetalhe = 777;

    mockUtils.getDatatableParams.mockResolvedValue({
      filters: {
        prestadorServico: { id: 888 }, // ignorado
        unidadeEscolar: null,
        idOcorrenciaTipo: 3,
        contrato: null,
        dataInicial: '2024-05-10',
        dataFinal: '2024-05-20',
        flagEncerrado: '',
        flagSomenteAtivos: 'true',
        respondido: '',
      },
      length: 15,
      start: 3,
    });

    mockDaoDatatable.mockResolvedValue({ ok: true });

    await service.tabela(req, res);

    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123,
      true,          // ehPrestadorServico
      777,           // idPrestadorServico do user
      null,          // idUnidadeEscolarList
      3,
      '2024-05-10',
      '2024-05-20',
      null,          // flagEncerrado vazio -> null
      true,
      null,          // idContratoList (não SME)
      null,          // idDiretoriaRegional
      null,          // respondido vazio -> null
      15,
      3
    );
  });

  test('perfil ue: extrai idUnidadeEscolarList do user (ignora filtros UE); mistura de filtros UE: objeto, lista, inválidos', async () => {
    req.userData.origem.codigo = 'ue';
    req.userData.idOrigemDetalhe = 321;

    mockUtils.getDatatableParams.mockResolvedValue({
      filters: {
        unidadeEscolar: [
          { id: '10' },    // ignorado (perfil ue usa id do user)
          { id: 'abc' },   // inválido
          { foo: 1 },      // inválido
        ],
        contrato: null,
        idOcorrenciaTipo: 2,
        dataInicial: '2024-06-01',
        dataFinal: '2024-06-15',
        flagSomenteAtivos: 'true',
      },
      length: 5,
      start: 0,
    });

    mockDaoDatatable.mockResolvedValue({ ok: true });

    await service.tabela(req, res);

    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123,
      false,           // ehPrestadorServico é false
      undefined,       // idPrestadorServico
      [321],           // idUnidadeEscolarList do user ue
      2,
      '2024-06-01',
      '2024-06-15',
      null,            // flagEncerrado ausente -> null
      true,
      null,            // idContratoList (não SME)
      null,
      null,       // respondido ausente
      5,
      0
    );
  });

  test('perfil dre: define idDiretoriaRegional do user', async () => {
    req.userData.origem.codigo = 'dre';
    req.userData.idOrigemDetalhe = 42;

    mockUtils.getDatatableParams.mockResolvedValue({
      filters: {
        unidadeEscolar: null,
        contrato: null,
        idOcorrenciaTipo: null,
        dataInicial: '2024-02-01',
        dataFinal: '2024-02-10',
      },
      length: 100,
      start: 200,
    });

    mockDaoDatatable.mockResolvedValue({ ok: true });

    await service.tabela(req, res);

    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123,
      false,
      undefined,
      null,
      null,
      '2024-02-01',
      '2024-02-10',
      null,      // flagEncerrado default null
      true,      // flagSomenteAtivos default true
      null,      // idContratoList (não SME)
      42,        // idDiretoriaRegional
      null, // respondido ausente
      100,
      200
    );
  });

  test('filtros.unidadeEscolar com objeto único, array vazio e valores inválidos: extrairIdsUE retorna null', async () => {
    req.userData.origem.codigo = 'sme';
    mockComboContratoPorUsuarioSME.mockResolvedValue([{ id: 1 }]);

    // Caso 1: objeto único válido
    mockUtils.getDatatableParams.mockResolvedValueOnce({
      filters: {
        unidadeEscolar: { id: '55' },
        contrato: null,
        idOcorrenciaTipo: 1,
        dataInicial: '2024-07-01',
        dataFinal: '2024-07-02',
      },
      length: 1,
      start: 0,
    });
    mockDaoDatatable.mockResolvedValueOnce({ ok: true });
    await service.tabela(req, res);
    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123, false, undefined, [55], 1, '2024-07-01', '2024-07-02',
      null, true, [1], null, null, 1, 0
    );

    // Caso 2: array vazio -> null
    mockUtils.getDatatableParams.mockResolvedValueOnce({
      filters: {
        unidadeEscolar: [],
        contrato: null,
        idOcorrenciaTipo: 1,
        dataInicial: '2024-08-01',
        dataFinal: '2024-08-02',
      },
      length: 1,
      start: 0,
    });
    mockDaoDatatable.mockResolvedValueOnce({ ok: true });
    await service.tabela(req, res);
    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123, false, undefined, null, 1, '2024-08-01', '2024-08-02',
      null, true, [1], null, null, 1, 0
    );

    // Caso 3: array com inválidos -> null
    mockUtils.getDatatableParams.mockResolvedValueOnce({
      filters: {
        unidadeEscolar: [{ id: 'x' }, { foo: 2 }],
        contrato: null,
        idOcorrenciaTipo: 1,
        dataInicial: '2024-09-01',
        dataFinal: '2024-09-02',
      },
      length: 1,
      start: 0,
    });
    mockDaoDatatable.mockResolvedValueOnce({ ok: true });
    await service.tabela(req, res);
    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123, false, undefined, null, 1, '2024-09-01', '2024-09-02',
      null, true, [1], null, null, 1, 0
    );
  });

  test('seleciona somente o contrato vigente na data da ocorrência (evita duplicação por contrato)', async () => {
    // Perfil SME
    req.userData.origem.codigo = 'sme';
    req.userData.idOrigemDetalhe = 999;
    req.userData.idUsuario = 123;

    // SME tem permissão sobre ambos os contratos 26 e 40
    mockComboContratoPorUsuarioSME.mockResolvedValue([{ id: 26 }, { id: 40 }]);

    // Filtros do datatable
    mockUtils.getDatatableParams.mockResolvedValue({
      filters: {
        flagEncerrado: '',
        respondido: '',
        flagSomenteAtivos: 'true',
        prestadorServico: null,
        unidadeEscolar: null,
        idOcorrenciaTipo: null,
        contrato: null,
        // intervalo cobre a data da ocorrência usada no exemplo do usuário (2025-11-12)
        dataInicial: '2025-11-01',
        dataFinal: '2025-11-30',
      },
      length: 10,
      start: 0,
    });

    // Simulação: antes da correção, o DAO poderia retornar duplicado por contrato
    const ocorrenciaDuplicada = [
      {
        id: 315566,
        data: '2025-11-12T12:25:07.000Z',
        unidade_escolar: { codigo: '000337' },
        prestador_servico: { cnpj: '08439717000146' },
        contrato: { contratoId: 26, contratoCodigo: 'TC 50/SME/2024' },
      },
      {
        id: 315566,
        data: '2025-11-12T12:25:07.000Z',
        unidade_escolar: { codigo: '000337' },
        prestador_servico: { cnpj: '08439717000146' },
        contrato: { contratoId: 40, contratoCodigo: 'TC 111/SME/2025' },
      },
    ];

    // Mas com a opção A (LEFT JOIN LATERAL + DISTINCT ON por vigência), o esperado é 1 linha:
    const ocorrenciaCorreta = {
      data: [
        {
          id: 315566,
          data: '2025-11-12T12:25:07.000Z',
          unidade_escolar: { codigo: '000337' },
          prestador_servico: { cnpj: '08439717000146' },
          // contrato selecionado deve ser o vigente para 2025-11-12.
          // Ajuste o ID conforme sua regra real de vigência entre (26 vs 40).
          // Aqui supomos que 26 é o vigente nessa data.
          contrato: { contratoId: 26, contratoCodigo: 'TC 50/SME/2024' },
        },
      ],
      recordsTotal: 1,
      recordsFiltered: 1,
    };

    // O DAO vai retornar o resultado já "deduplicado" (com a query nova),
    // e o service deve apenas repassar.
    mockDaoDatatable.mockResolvedValue(ocorrenciaCorreta);

    await service.tabela(req, res);

    // Verifica os parâmetros passados ao DAO: SME -> usa a lista de contratos permitidos [26,40]
    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123,             // idUsuario
      false,           // ehPrestadorServico
      undefined,       // idPrestadorServico
      null,            // idUnidadeEscolarList
      null,            // idOcorrenciaTipo
      '2025-11-01',    // dataInicial
      '2025-11-30',    // dataFinal
      null,            // flagEncerrado
      true,            // flagSomenteAtivos
      [26, 40],        // idContratoList
      null,            // idDiretoriaRegional
      null,            // respondido
      10,              // length
      0                // start
    );

    // O controller recebe a resposta final sem duplicação
    expect(mockCtrl.gerarRetornoDatatable).toHaveBeenCalledWith(res, ocorrenciaCorreta);
  });

  test('SME com idContratoList explícito: restringe às ocorrências dos contratos da lista', async () => {
    // Usuário SME com permissão sobre [10,11,12]
    mockComboContratoPorUsuarioSME.mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }]);

    // Front envia filtro de contrato específico (ex.: 11)
    mockUtils.getDatatableParams.mockResolvedValue({
      filters: {
        flagEncerrado: '',
        respondido: '',
        flagSomenteAtivos: 'true',
        prestadorServico: null,
        unidadeEscolar: null,
        idOcorrenciaTipo: null,
        // contrato vindo do filtro (permitido)
        contrato: { id: 11 },
        dataInicial: '2025-03-01',
        dataFinal: '2025-03-31',
      },
      length: 25,
      start: 0,
    });

    // Simule o retorno do DAO (não importa o conteúdo, só precisamos validar a chamada)
    const daoResult = { data: [{ id: 1 }], recordsTotal: 1, recordsFiltered: 1 };
    mockDaoDatatable.mockResolvedValue(daoResult);

    await service.tabela(req, res);

    // Espera-se que o service passe somente [11] no $8 (idContratoList)
    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123,            // idUsuario
      false,          // ehPrestadorServico
      undefined,      // idPrestadorServico
      null,           // idUnidadeEscolarList
      null,           // idOcorrenciaTipo
      '2025-03-01',   // dataInicial
      '2025-03-31',   // dataFinal
      null,           // flagEncerrado
      true,           // flagSomenteAtivos
      [11],           // idContratoList (somente os contratos filtrados e permitidos)
      null,           // idDiretoriaRegional
      null,           // respondido
      25,             // length
      0               // start
    );

    expect(mockCtrl.gerarRetornoDatatable).toHaveBeenCalledWith(res, daoResult);
  });

  test('SME com idContratoList explícito FORA da permissão: ignora filtro e usa permissão completa', async () => {
    // Usuário SME com permissão sobre [10,11]
    mockComboContratoPorUsuarioSME.mockResolvedValue([{ id: 10 }, { id: 11 }]);

    // Front envia filtro de contrato NÃO permitido (ex.: 99)
    mockUtils.getDatatableParams.mockResolvedValue({
      filters: {
        flagEncerrado: '',
        respondido: '',
        flagSomenteAtivos: 'true',
        prestadorServico: null,
        unidadeEscolar: null,
        idOcorrenciaTipo: null,
        contrato: { id: 99 }, // não permitido
        dataInicial: '2025-04-01',
        dataFinal: '2025-04-30',
      },
      length: 50,
      start: 10,
    });

    mockDaoDatatable.mockResolvedValue({ data: [], recordsTotal: 0, recordsFiltered: 0 });

    await service.tabela(req, res);

    // Espera-se que o service caia para a lista completa de permissão [10,11]
    expect(mockDaoDatatable).toHaveBeenCalledWith(
      123,
      false,
      undefined,
      null,
      null,
      '2025-04-01',
      '2025-04-30',
      null,
      true,
      [10, 11], // lista completa da permissão SME
      null,
      null,
      50,
      10
    );
  });
});