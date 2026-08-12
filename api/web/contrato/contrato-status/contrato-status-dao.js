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

}

module.exports = ContratoStatusDao;