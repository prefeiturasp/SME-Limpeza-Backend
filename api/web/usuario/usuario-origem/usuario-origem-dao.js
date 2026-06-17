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

    carregarComboDrePs(idPrestadorServico) {
        return this.queryFindAll(`
            select distinct dr.id_diretoria_regional as id, dr.descricao
            from diretoria_regional dr
            join unidade_escolar ue using (id_diretoria_regional)
            join contrato_unidade_escolar cue using (id_unidade_escolar)
            join contrato c using (id_contrato)
            where c.id_prestador_servico = $1 and dr.flag_ativo
            order by dr.descricao
        `, [idPrestadorServico]);
    }

}

module.exports = UsuarioOrigemDao;