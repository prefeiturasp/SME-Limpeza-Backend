jest.mock('rfr', () => {
  const state = {
    ctrl: {
      gerarRetornoErro: jest.fn(async () => {}),
      gerarRetornoOk: jest.fn(async () => {}),
    },
  };
  const rfrFn = (relPath) => {
    if (relPath === 'core/controller.js') return state.ctrl;
    return {};
  };
  rfrFn.__getState = () => state;
  return rfrFn;
});

// Mocks de libs usadas no arquivo (inócuos para este teste)
jest.mock('bcrypt', () => ({ hashSync: jest.fn(() => 'hash') }));
jest.mock('html-pdf', () => ({ create: jest.fn(() => ({ toBuffer: jest.fn() })) }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));
jest.mock('jszip', () => jest.fn());
jest.mock('moment', () => () => ({ format: () => '20250101-000000' }));

// Mock do DAO principal utilizado por inserir
jest.mock('../ambiente-unidade-escolar-dao', () => {
  const interno = { lastInstance: null };
  const Ctor = jest.fn().mockImplementation(() => {
    const api = {
      insert: jest.fn(),
      atualizarHash: jest.fn(),
    };
    interno.lastInstance = api;
    return api;
  });
  Ctor.__getLastInstance = () => interno.lastInstance;
  return Ctor;
});

// Mock dos outros DAOs apenas para não quebrar o require do service
jest.mock('../../../../unidade-escolar/unidade-escolar-dao', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../ambiente-geral/ambiente-geral-dao', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../tipo-ambiente/tipo-ambiente-dao', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../../../usuario/usuario/usuario-dao', () => jest.fn().mockImplementation(() => ({})));

const rfr = require('rfr');
const DaoMock = require('../ambiente-unidade-escolar-dao');
const service = require('../ambiente-unidade-escolar-service');
const ctrl = rfr.__getState().ctrl;

describe('inserir - sem areaAmbiente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deve enviar 0 para o DAO e retornar OK quando areaAmbiente não é informado', async () => {
    const req = {
      userData: { origem: { codigo: 'sme' } },
      body: {
        unidadeEscolar: { id: 10 },
        idAmbienteGeral: 20,
        descricao: 'Sala 101',
      },
    };
    const res = {};

    const daoInst = DaoMock.__getLastInstance();
    daoInst.insert.mockResolvedValueOnce(123);
    daoInst.atualizarHash.mockResolvedValueOnce();
    
    await service.inserir(req, res);

    expect(daoInst.insert).toHaveBeenCalledWith(10, 20, 'Sala 101', 0);
    expect(daoInst.atualizarHash).toHaveBeenCalledWith(123, 'hash', undefined);
    expect(ctrl.gerarRetornoOk).toHaveBeenCalledWith(res);
    expect(ctrl.gerarRetornoErro).not.toHaveBeenCalled();
  });
});