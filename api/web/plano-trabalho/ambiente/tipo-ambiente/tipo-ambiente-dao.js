const GenericDao = require('rfr')('core/generic-dao.js');

class TipoAmbienteDao extends GenericDao {

    constructor() {
        super('tipo_ambiente');
    }

    combo() {
        return this.queryFindAll(`
            select id_tipo_ambiente as id, descricao, codigo
            from tipo_ambiente 
            order by descricao
        `);
    }

    buscarPorCodigo(codigo) {
        return this.queryFindOne(`
            select id_tipo_ambiente as id, *
            from tipo_ambiente
            where codigo ILIKE (TRIM($1))
        `, [codigo]);
    }

}

module.exports = TipoAmbienteDao;