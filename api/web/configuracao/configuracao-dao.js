const GenericDao = require('rfr')('core/generic-dao.js');

class ConfiguracaoDao extends GenericDao {

  constructor() {
    super('configuracao');
  }

  buscar(parametro) {

    const sql = `
      select * from configuracao
      where parametro = $1`;

    return this.queryFindOne(sql, [parametro]);

  }

  buscarTodos() {

    const sql = `
      select *, valor as novo_valor
      from configuracao
      where parametro in ('DIAS_RET_OCORRENCIA', 'DIAS_RET_DECLARACAO', 'DIAS_ENCERRAMENTO_OCORRENCIA')
      order by parametro`;

    return this.queryFindAll(sql);

  }

  atualizarValor(parametro, valor) {

    const sql = `
      update configuracao set valor = $2
      where parametro = $1`;

    return this.query(sql, [parametro, valor]);

  }

  atualizarDescricao(parametro, descricao) {

    const sql = `
      update configuracao set descricao = $2
      where parametro = $1`;

    return this.query(sql, [parametro, descricao]);

  }

  buscaManutencaoSistema() {
    const sql = `select * from configuracao where parametro = 'MANUTENCAO_SISTEMA'`;
    return this.queryFindOne(sql);
  }

  salvaManutencaoSistema(valor) {
    const sql = `update configuracao set valor = $1 where parametro = 'MANUTENCAO_SISTEMA'`;
    return this.query(sql, [valor]);
  }

  async buscarParametrosEmail() {
    const sql = `
      SELECT parametro, valor, descricao
      FROM configuracao
      WHERE parametro LIKE 'EMAIL_NOTIFICACAO_%'
      ORDER BY parametro`;
    return this.queryFindAll(sql);
  }

  async atualizarParametro(parametro, valor, _transaction) {
    const sql = `
      UPDATE configuracao
      SET valor = $1
      WHERE parametro = $2`;
    return this.query(sql, [valor, parametro], _transaction);
  }

  async buscarListaEmailsParaNotificacoes() {
    const sql = `
      SELECT descricao
      FROM configuracao
      WHERE parametro = 'EMAIL_NOTIFICACAO_LISTA_EMAILS'`;
    return this.queryFindOne(sql);
  }

  async salvarEmailsParaNotificacoes(emails) {
    const sql = `
      UPDATE configuracao
      SET descricao = $1
      WHERE parametro = 'EMAIL_NOTIFICACAO_LISTA_EMAILS'`;
    return this.query(sql, [emails]);
  }


}

module.exports = ConfiguracaoDao;