const GenericDao = require('rfr')('core/generic-dao.js');

class UnidadeEscolarDao extends GenericDao {

  constructor() {
    super('unidade_escolar');
  }

  buscarPorCodigoAndPrestadorServico(idPrestadorServico, codigo) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.codigo, ue.descricao
      from unidade_escolar ue
      join contrato_unidade_escolar cue using (id_unidade_escolar)
      join contrato c using (id_contrato)
      where c.id_prestador_servico = $1 and ue.codigo ILIKE ($2::text)`;

    return this.queryFindOne(sql, [idPrestadorServico, codigo]);

  }

  buscarPorId(idUnidadeEscolar) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.codigo, ue.descricao, 
        ue.endereco || ', ' || ue.numero || ', ' || ue.bairro as endereco
      from unidade_escolar ue
      where ue.id_unidade_escolar = $1`;

    return this.queryFindAll(sql, [idUnidadeEscolar]);

  }

  comboPorPrestadorServicoAndUsuario(idPrestadorServico) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.codigo, ue.descricao, 
          ue.endereco || ', ' || ue.numero || ', ' || ue.bairro as endereco
      from unidade_escolar ue
      join contrato_unidade_escolar cue using (id_unidade_escolar)
      join contrato c using (id_contrato)
      where c.id_prestador_servico = $1`;

    return this.queryFindAll(sql, [idPrestadorServico]);

  }

}

module.exports = UnidadeEscolarDao;