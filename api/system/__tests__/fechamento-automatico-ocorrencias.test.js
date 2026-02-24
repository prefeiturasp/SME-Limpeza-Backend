const path = require('path');
const fs = require('fs');
const moment = require('moment');

jest.mock('rfr', () => {
    // Mock do rfr para retornar nossos módulos falsos quando 'core/database' e 'core/email' forem requeridos.
    return (modulePath) => {
        if (modulePath === 'core/database') return mockDb;
        if (modulePath === 'core/email') return mockEmail;
        throw new Error(`rfr mock: módulo inesperado: ${modulePath}`);
    };
});

// Mocks compartilhados
const mockDb = {
    iniciarTransaction: jest.fn(),
    finalizarTransaction: jest.fn(),
    findAll: jest.fn(),
};

const mockEmail = {
    enviar: jest.fn(),
};

// Util para criar res fake que captura writes
function createFakeRes() {
    let buffer = '';
    return {
        write: jest.fn((chunk) => {
            buffer += chunk;
        }),
        end: jest.fn(),
        getOutput: () => buffer,
    };
}

describe('Job: Fechamento automático de ocorrências', () => {
    let job;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        process.env.EMAIL_NOTIFICATION = 'alerts@example.com';

        mockDb.iniciarTransaction.mockResolvedValue({ tx: true });
        mockDb.finalizarTransaction.mockResolvedValue(undefined);

        mockDb.findAll.mockImplementation(async (sql) => {
            const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
            if (normalized.includes('from configuracao') && normalized.includes('dias_encerramento_ocorrencia')) {
                return [{ valor: '2' }];
            }
            if (normalized.startsWith('select count(*)')) {
                return [{ total: 3 }];
            }
            if (normalized.startsWith('update ocorrencia')) {
                return [
                    { id_ocorrencia: 101, data_hora_cadastro: new Date('2024-01-01T10:00:00Z') },
                    { id_ocorrencia: 102, data_hora_cadastro: new Date('2024-01-02T11:00:00Z') },
                ];
            }
            return [];
        });

        mockEmail.enviar.mockResolvedValue(true);

        // Importa o job após configurar os mocks
        job = require('../fechamento-automatico-ocorrencias.js');
    });

    test('deve executar com sucesso, finalizar transação e escrever logs', async () => {
        const res = createFakeRes();

        await job({}, res);

        expect(res.write).toHaveBeenCalledWith('<pre>');
        expect(res.end).toHaveBeenCalled();

        expect(mockDb.iniciarTransaction).toHaveBeenCalledTimes(1);
        expect(mockDb.finalizarTransaction).toHaveBeenCalledWith(true, expect.any(Object));

        expect(mockDb.findAll).toHaveBeenCalledWith(
            expect.stringContaining('from configuracao'),
            expect.any(Array),
            expect.any(Object)
        );
        expect(mockDb.findAll).toHaveBeenCalledWith(
            expect.stringContaining('select count(*)'),
            expect.any(Array),
            expect.any(Object)
        );
        expect(mockDb.findAll).toHaveBeenCalledWith(
            expect.stringContaining('update ocorrencia'),
            expect.any(Array),
            expect.any(Object)
        );

        const out = res.getOutput();
        // Os textos exatos podem variar conforme sua string; aqui validamos trechos importantes:
        expect(out).toContain('Iniciando processamento - Encerrar ocorrencias abertas ha > 2 dia(s)');
        expect(out).toContain('Ocorrencias elegiveis: 3');
        expect(out).toContain('Ocorrencias encerradas automaticamente: 2');
        expect(out).toContain('Processo concluido com sucesso');
        expect(out).toContain('<b>');
        expect(out).toContain('</pre>');
    });

    test('deve fazer rollback e enviar e-mail em caso de erro', async () => {
        mockDb.findAll.mockRejectedValueOnce(new Error('falha no banco'));

        const res = createFakeRes();
        await job({}, res);

        expect(mockDb.finalizarTransaction).toHaveBeenCalledWith(false, expect.any(Object));

        expect(mockEmail.enviar).toHaveBeenCalledWith(
            expect.any(String),
            expect.stringContaining('ERRO | Cron - Encerrar ocorrencias automaticamente por prazo'),
            expect.stringContaining('<pre>')
        );

        const out = res.getOutput();
        expect(out).toContain('ERRO: Transaction Rollback');
        expect(out).toContain('ERRO: falha no banco');
    });

    test('fallback para 2 dias quando configuração inválida', async () => {
        mockDb.findAll.mockImplementation(async (sql) => {
            const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
            if (normalized.includes('from configuracao')) {
                return []; // sem valor
            }
            if (normalized.startsWith('select count(*)')) {
                return [{ total: 0 }];
            }
            if (normalized.startsWith('update ocorrencia')) {
                return [];
            }
            return [];
        });

        const res = createFakeRes();
        await job({}, res);

        const out = res.getOutput();
        expect(out).toContain('Encerrar ocorrencias abertas ha > 2 dia(s)');
        expect(mockDb.finalizarTransaction).toHaveBeenCalledWith(true, expect.any(Object));
    });
});

describe('Utils: subtrairDiasUteis & carregarFeriadosCSVComoSet', () => {
    let utils;

    beforeEach(() => {
        jest.resetModules();
        // Re-require the module to pick up the _test exports (mocks for rfr are same as above)
        const jobModule = require('../fechamento-automatico-ocorrencias.js');
        utils = jobModule._test;
    });

    test('carregarFeriadosCSVComoSet deve ler CSV e retornar Set de YYYY-MM-DD', () => {
        // Local do arquivo esperado pelo módulo
        const modDir = path.dirname(require.resolve('../fechamento-automatico-ocorrencias.js'));
        const utilsDir = path.join(modDir, 'utils');
        const csvPath = path.join(utilsDir, 'feriadosFechamentoAutomatico.csv');

        // Garantir diretório utils
        fs.mkdirSync(utilsDir, { recursive: true });

        // Escrever CSV com header e 2 datas no formato DD-MM-YYYY
        const conteudo = [
            'data;descricao',
            '19-11-2025;Feriado A',
            '20-11-2025;Feriado B',
            '', // linha vazia deve ser ignorada
        ].join('\n');
        fs.writeFileSync(csvPath, conteudo, 'utf8');

        const set = utils.carregarFeriadosCSVComoSet();
        expect(set.has('2025-11-19')).toBe(true);
        expect(set.has('2025-11-20')).toBe(true);
        // cleanup
        fs.unlinkSync(csvPath);
    });

    test('subtrairDiasUteis deve descontar apenas dias úteis ignorando feriados e fins de semana', () => {
        // Suponha que hoje seja 2025-11-24 10:00 (segunda -> terça no exemplo original)
        const dataInicial = new Date('2025-11-24T10:00:00'); // 24/11/2025
        // feriados: 20/11 e 21/11 (no formato YYYY-MM-DD)
        const feriadosSet = new Set(['2025-11-20', '2025-11-21']);

        // Subtrair 2 dias úteis -> deve resultar em 2025-11-18 T10:00:00
        const resultado = utils.subtrairDiasUteis(dataInicial, 2, feriadosSet);
        const fmt = moment(resultado).format('YYYY-MM-DD HH:mm');
        expect(fmt).toBe('2025-11-18 10:00');
    });

    test('subtrairDiasUteis com valor não inteiro arredonda para baixo; zero ou inválido retorna data original', () => {
        const dataInicial = new Date('2025-12-10T08:30:00');
        const feriadosSet = new Set();

        // valor fracionário 2.9 => floor => 2 dias úteis
        const r1 = utils.subtrairDiasUteis(dataInicial, 2.9, feriadosSet);
        expect(moment(r1).isBefore(moment(dataInicial))).toBe(true);

        // diasInteiros <= 0 retorna a mesma data (timestamp igual)
        const r2 = utils.subtrairDiasUteis(dataInicial, 0, feriadosSet);
        expect(moment(r2).toISOString()).toBe(moment(dataInicial).toISOString());

        const r3 = utils.subtrairDiasUteis(dataInicial, -5, feriadosSet);
        expect(moment(r3).toISOString()).toBe(moment(dataInicial).toISOString());
    });
});
