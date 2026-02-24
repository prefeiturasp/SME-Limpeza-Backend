const GenericDao = require('rfr')('core/generic-dao.js');

class DiretoriaRegional extends GenericDao {

    constructor() {
        super('diretoria_regional');
    }

    buscar(id) {
        return this.queryFindOne(`
            select id_diretoria_regional as id, descricao, email
            from diretoria_regional
            where id_diretoria_regional = $1
        `, [id]);
    }

    buscarPorDescricaoAndAtivo(descricao, _transaction) {
        return this.queryFindOne(`
            select id_diretoria_regional as id, *
            from diretoria_regional
            where flag_ativo and descricao = $1
        `, [descricao], _transaction);
    }

    datatable(descricao, idOrigemDetalhe, length, start) {
        return this.queryFindAll(`
            select count(*) over() as records_total, id_diretoria_regional as id, descricao, endereco, bairro, cep, telefone, email, flag_ativo
            from diretoria_regional
            where flag_ativo 
                and case when $1::TEXT is null then true else descricao ILIKE ('%' || $1::TEXT || '%') end
                and case when $2::int is null then true else id_diretoria_regional = $2::int end 
            order by descricao limit $3 offset $4
        `, [descricao, idOrigemDetalhe, length, start]);
    }

    insert(descricao, endereco, bairro, cep, telefone, email, _transaction) {
        return this.query(`
            insert into diretoria_regional (descricao, endereco, bairro, cep, telefone, email) 
            values ($1, $2, $3, $4, $5, $6)
        `, [descricao, endereco, bairro, cep, telefone, email], _transaction);
    }

    atualizar(id, descricao, endereco, bairro, cep, telefone, email, _transaction) {
        return this.query(`
            update diretoria_regional set descricao = $1, endereco = $2, bairro = $3, cep = $4, telefone = $5, email = $6 
            where id_diretoria_regional = $7
        `, [descricao, endereco, bairro, cep, telefone, email, id], _transaction);
    }

    remover(_transaction, id) {
        return this.query(`
            update diretoria_regional set flag_ativo = false 
            where id_diretoria_regional = $1
        `, [id], _transaction);
    }

    combo(idOrigemDetalhe) {
        return this.queryFindAll(`
            select id_diretoria_regional as id, descricao 
            from diretoria_regional 
            where flag_ativo 
                and case when $1::int is null then true else id_diretoria_regional = $1::int end
            order by descricao
        `, [idOrigemDetalhe]);
    }

    comboTodos(idOrigemDetalhe) {
        return this.queryFindAll(`
            select id_diretoria_regional as id, descricao 
            from diretoria_regional
            where case when $1::int is null then true else id_diretoria_regional = $1::int end
            order by descricao
        `, [idOrigemDetalhe]);
    }

}

module.exports = DiretoriaRegional;