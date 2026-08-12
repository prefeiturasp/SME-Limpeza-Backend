const GenericDao = require('rfr')('core/generic-dao.js');

class ContratoStatusDao extends GenericDao {

  constructor() {
    super('contrato_status');
  }

  comboStaContrato() {

    const sql = `select id_status_contrato as id, descricao 
      from status_contrato
      order by descricao`;

    return this.queryFindAll(sql);

  }

  atualizarStatusContrato(idContrato, idStatusContrato, motivoStatusContrato) {
    
    return this.query(`update contrato set id_status_contrato = $1, motivo_status = $2 where id_contrato = $3`, [idStatusContrato, motivoStatusContrato, idContrato]);

  }

  historicoStatusContrato(idContrato) {

    const sql = `select h.id, h.id_contrato, u.nome as usuario, sa.descricao AS status_antigo, sn.descricao AS status_novo, h.motivo, h.data_hora
        from contrato_status_historico h
        left join usuario u on u.id_usuario = h.id_usuario
        left join status_contrato sa on sa.id_status_contrato = h.id_status_antigo
        left join status_contrato sn on sn.id_status_contrato = h.id_status_novo
        where h.id_contrato = $1
        order by h.data_hora desc`;

    return this.queryFindAll(sql, [idContrato]);

  }

  buscarIdUsuPorEmail(emailUsu) {

    const sql = `select id_usuario from usuario where email = $1`;
    return this.queryFindOne(sql, [emailUsu]);

  }

  salvaHistoricoStatusContrato(idContrato, statusAntigo, statusNovo, motivoStatus, idUsu){

    const sql = `
        insert into contrato_status_historico (
        id_contrato, 
        id_status_antigo, 
        id_status_novo,
        motivo,
        id_usuario
      ) values ($1, $2, $3, $4, $5)`;
      
      return this.query(sql, [idContrato, statusAntigo, statusNovo, motivoStatus, idUsu]);

  }

}

module.exports = ContratoStatusDao;