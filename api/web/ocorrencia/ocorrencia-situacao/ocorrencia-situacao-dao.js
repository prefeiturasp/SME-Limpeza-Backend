const GenericDao = require('rfr')('core/generic-dao.js');

class OcorrenciaSituacaoDao extends GenericDao {

    constructor() {
        super('ocorrencia_situacao');
    }

    combo() {
        return this.queryFindAll(`
            select id_ocorrencia_situacao as id, descricao, classe 
            from ocorrencia_situacao
            order by id_ocorrencia_situacao
        `);
    }

}

module.exports = OcorrenciaSituacaoDao;