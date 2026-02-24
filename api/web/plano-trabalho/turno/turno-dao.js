const GenericDao = require('rfr')('core/generic-dao.js');

class TurnoDao extends GenericDao {

    constructor() {
        super('turno');
    }

    combo() {
        return this.queryFindAll(`
            select id_turno as id, codigo, descricao
            from turno
            order by ordem
        `);
    }

}

module.exports = TurnoDao;