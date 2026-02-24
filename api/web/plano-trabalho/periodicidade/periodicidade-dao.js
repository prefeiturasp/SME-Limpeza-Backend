const GenericDao = require('rfr')('core/generic-dao.js');

class PeriodicidadeDao extends GenericDao {

    constructor() {
        super('periodicidade');
    }

    combo() {
        return this.queryFindAll(`
            select id_periodicidade as id, codigo, descricao
            from periodicidade
            where flag_ativo 
            order by ordem
        `);
    }

}

module.exports = PeriodicidadeDao;