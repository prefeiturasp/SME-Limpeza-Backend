const GenericDao = require('rfr')('core/generic-dao.js');

class FeriadoDao extends GenericDao {

    constructor() {
        super('feriado');
    }

    datatable(idUnidadeEscolar, length, start) {
        return this.queryFindAll(`
            select 
                count(f.*) over() as records_total, 
                f.id_feriado as id, 
                f.descricao, 
                f.data
            from feriado f
            where f.id_unidade_escolar = $1
            order by f.data 
            limit $2 offset $3
        `, [idUnidadeEscolar, length, start]);
    }

    insert(idUnidadeEscolar, data, descricao) {
        return this.query(`
            insert into feriado (id_unidade_escolar, data, descricao) 
            values ($1, $2, $3)
        `, [idUnidadeEscolar, data, descricao]);
    }

    atualizar(id, descricao) {
        return this.query(`
            update feriado set descricao = $1
            where id_feriado = $2
        `, [descricao, id]);
    }

    remover(id) {
        return this.query(`
            DELETE from feriado
            where id_feriado = $1
        `, [id]);
    }

}

module.exports = FeriadoDao;