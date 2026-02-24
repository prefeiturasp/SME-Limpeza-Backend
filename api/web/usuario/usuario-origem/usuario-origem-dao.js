const GenericDao = require('rfr')('core/generic-dao.js');

class UsuarioOrigemDao extends GenericDao {

    constructor() {
        super('usuario_origem');
    }

    combo(idUsuarioCargo) {
        return this.queryFindAll(`
            select distinct(uo.id_usuario_origem) as id, uo.descricao, uo.codigo
            from usuario_origem uo
            join usuario_cargo uc using (id_usuario_origem)
            join usuario_cargo_permissao_cadastro ucpc using (id_usuario_cargo)
            where ucpc.id_usuario_cargo_requisicao = $1
            order by uo.id_usuario_origem
        `, [idUsuarioCargo]);
    }

}

module.exports = UsuarioOrigemDao;