// Garante que a busca de usuário por e-mail use comparação exata (=) e não ILIKE.
// No ILIKE, "_" é curinga de um caractere, então "maria_fatima@..." encontrava
// "maria.fatima@..." e o login era associado ao cadastro errado.

jest.mock('rfr', () => {
    // Mock do rfr para substituir o GenericDao por uma versão que só captura o SQL.
    return (modulePath) => {
        if (modulePath === 'core/generic-dao.js') return mockGenericDao;
        throw new Error(`rfr mock: módulo inesperado: ${modulePath}`);
    };
});

const mockQueryFindOne = jest.fn();

class mockGenericDao {
    constructor(tabela) {
        this.tabela = tabela;
    }

    queryFindOne(sql, params, _transaction) {
        return mockQueryFindOne(sql, params, _transaction);
    }
}

const UsuarioDao = require('../usuario-dao');

function normalizar(sql) {
    return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function filtroEmail(sql) {
    const normalized = normalizar(sql);
    const match = normalized.match(/where (unaccent\(lower\(u\.email\)\) .+? unaccent\(lower\(trim\(\$1\)\)\))/);
    return match && match[1];
}

describe('UsuarioDao: busca por e-mail', () => {
    let dao;

    beforeEach(() => {
        jest.clearAllMocks();
        mockQueryFindOne.mockResolvedValue(undefined);
        dao = new UsuarioDao();
    });

    describe('findDetalhadoByEmail', () => {
        it('compara o e-mail com igualdade exata, sem ILIKE/LIKE', async () => {
            await dao.findDetalhadoByEmail('maria_fatima@sme.prefeitura.sp.gov.br');

            const [sql] = mockQueryFindOne.mock.calls[0];
            expect(filtroEmail(sql)).toBe('unaccent(lower(u.email)) = unaccent(lower(trim($1)))');
            expect(normalizar(sql)).not.toMatch(/\b(i?like)\b/);
        });

        it('repassa o e-mail sem alteração e a transação recebida', async () => {
            const transaction = { tx: true };

            await dao.findDetalhadoByEmail('maria_fatima@sme.prefeitura.sp.gov.br', transaction);

            const [, params, _transaction] = mockQueryFindOne.mock.calls[0];
            expect(params).toEqual(['maria_fatima@sme.prefeitura.sp.gov.br']);
            expect(_transaction).toBe(transaction);
        });
    });

    describe('verificaVinculoContrato', () => {
        it('compara o e-mail com igualdade exata, sem ILIKE/LIKE', async () => {
            await dao.verificaVinculoContrato('rose_l@sme.prefeitura.sp.gov.br');

            const [sql, params] = mockQueryFindOne.mock.calls[0];
            expect(filtroEmail(sql)).toBe('unaccent(lower(u.email)) = unaccent(lower(trim($1)))');
            expect(normalizar(sql)).not.toMatch(/\b(i?like)\b/);
            expect(params).toEqual(['rose_l@sme.prefeitura.sp.gov.br']);
        });
    });
});
