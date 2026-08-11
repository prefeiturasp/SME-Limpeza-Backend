const GenericDao = require('rfr')('core/generic-dao.js');

class UnidadeEscolarStatusDao extends GenericDao {

  constructor() {
    super('unidade_escolar_status');
  }

  combo() {

    const sql = `
      select id_status_unidade_escolar as id, descricao 
      from status_unidade_escolar
      order by descricao`;

    return this.queryFindAll(sql);

  }

}

module.exports = UnidadeEscolarStatusDao;