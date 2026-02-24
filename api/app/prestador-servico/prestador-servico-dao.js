const GenericDao = require('rfr')('core/generic-dao.js');

class PrestadorServicoDao extends GenericDao {

  constructor() {
    super('prestador_servico');
  }

  findByCnpj(cnpj) {

    const sql = `
      select ps.* from prestador_servico ps 
      where flag_ativo and cnpj = $1`;

    return this.queryFindOne(sql, [cnpj]);

  }

  buscarUnidadeEscolar(id, idUnidadeEscolar) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.codigo, ue.descricao
      from unidade_escolar ue
      join contrato_unidade_escolar cue using (id_unidade_escolar)
      join contrato c using (id_contrato)
      where c.id_prestador_servico = $1 and cue.id_unidade_escolar = $2`;

    return this.queryFindOne(sql, [id, idUnidadeEscolar]);

  }

}

module.exports = PrestadorServicoDao;