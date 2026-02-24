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

}

module.exports = ConfiguracaoDao;