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

  historicoStatusUE(idContrato, idUe) {

    const sql = `select h.id, h.id_contrato, u.nome as usuario, h.id_unidade_escolar, sa.descricao AS status_antigo, sn.descricao AS status_novo, h.motivo, h.data_hora
        from contrato_unidade_status_historico h
        left join usuario u on u.id_usuario = h.id_usuario
        left join status_unidade_escolar sa on sa.id_status_unidade_escolar = h.id_status_antigo
        left join status_unidade_escolar sn on sn.id_status_unidade_escolar = h.id_status_novo
        where h.id_contrato = $1 and h.id_unidade_escolar = $2
        order by h.data_hora desc`;

    return this.queryFindAll(sql, [idContrato, idUe]);

  }

  salvaHistoricoStatusUE(idContrato, idUe, statusAntigo, statusNovo, motivoStatus, idUsu){

    const sql = `
        insert into contrato_unidade_status_historico (id_contrato, id_unidade_escolar, id_status_antigo, id_status_novo, motivo, id_usuario) 
        values ($1, $2, $3, $4, $5, $6)`;
      
      return this.query(sql, [idContrato, idUe, statusAntigo, statusNovo, motivoStatus, idUsu]);

  }

}

module.exports = UnidadeEscolarStatusDao;