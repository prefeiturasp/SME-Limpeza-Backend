const GenericDao = require('rfr')('core/generic-dao.js');

class UsuarioStatusDao extends GenericDao {

    constructor() {
        super('usuario_status');
    }

    combo() {
        return this.queryFindAll(`
            select id_usuario_status as id, descricao, codigo
            from usuario_status
            order by descricao
        `);
    }

}

module.exports = UsuarioStatusDao;