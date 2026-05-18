const GenericDao = require('rfr')('core/generic-dao.js');

class FeriadoGeralDao extends GenericDao {

    constructor() {
        super('feriado_geral');
    }

    datatable(length, start) {
        return this.queryFindAll(`
            select 
                count(f.*) over() as records_total, 
                f.id_feriado_geral as id, 
                f.descricao, 
                f.data, 
                f.recorrente
            from feriado_geral f
            order by f.data 
            limit $1 offset $2
        `, [length, start]);
    }

    insert(data, descricao, recorrente) {
        return this.query(`
            insert into feriado_geral (data, descricao, recorrente) 
            values ($1, $2, $3)
        `, [data, descricao, recorrente]);
    }

    atualizar(id, data, descricao, recorrente) {
        return this.query(`
            update feriado_geral set data = $1, descricao = $2, recorrente = $3
            where id_feriado_geral = $4
        `, [data, descricao, recorrente, id]);
    }

    remover(id) {
        return this.query(`
            DELETE from feriado_geral
            where id_feriado_geral = $1
        `, [id]);
    }

}

module.exports = FeriadoGeralDao;