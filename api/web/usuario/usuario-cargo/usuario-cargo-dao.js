const GenericDao = require('rfr')('core/generic-dao.js');

class UsuarioCargoDao extends GenericDao {

    constructor() {
        super('usuario_cargo');
    }

    combo(idUsuarioOrigem) {
        return this.queryFindAll(`
            select uc.id_usuario_cargo as id, uc.descricao
            from usuario_cargo uc
            where uc.id_usuario_origem = $1
            order by uc.descricao
        `, [idUsuarioOrigem]);
    }

}

module.exports = UsuarioCargoDao;