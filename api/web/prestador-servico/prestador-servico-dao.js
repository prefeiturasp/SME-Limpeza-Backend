const GenericDao = require('rfr')('core/generic-dao.js');

class PrestadorServicoDao extends GenericDao {

    constructor() {
        super('prestador_servico');
    }

    buscar(id) {
        return this.queryFindOne(`
            select id_prestador_servico as id, razao_social, razao_social as descricao, cnpj, endereco, numero, bairro, cep, telefone, email
            from prestador_servico
            where id_prestador_servico = $1
        `, [id]);
    }

    datatable(razaoSocial, length, start) {
        return this.queryFindAll(`
            select count(*) over() as records_total, id_prestador_servico as id, razao_social, cnpj
            from prestador_servico
            where flag_ativo and case when $1::TEXT is null then true else razao_social ILIKE ('%' || $1::TEXT || '%') end
            order by razao_social limit $2 offset $3
        `, [razaoSocial, length, start]);
    }

    insert(razaoSocial, cnpj, endereco, numero, bairro, cep, telefone, email, senhaAplicativo) {
        return this.query(`
            insert into prestador_servico (razao_social, cnpj, endereco, numero, bairro, cep, telefone, email, senha_aplicativo) 
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [razaoSocial, cnpj, endereco, numero, bairro, cep, telefone, email, senhaAplicativo]);
    }

    atualizar(id, razaoSocial, cnpj, endereco, numero, bairro, cep, telefone, email) {
        return this.query(`
            update prestador_servico set razao_social = $1, cnpj = $2, endereco = $3, numero= $4, bairro = $5, cep = $6, telefone = $7, email = $8 where id_prestador_servico = $9
        `, [razaoSocial, cnpj, endereco, numero, bairro, cep, telefone, email, id]);
    }

    remover(id) {
        return this.query(`
            update prestador_servico set flag_ativo = false 
            where id_prestador_servico = $1
        `, [id]);
    }

    combo() {
        return this.queryFindAll(`
            select id_prestador_servico as id, razao_social as descricao, razao_social, cnpj 
            from prestador_servico 
            where flag_ativo 
            order by razao_social
        `);
    }

    comboTodos() {
        return this.queryFindAll(`
            select id_prestador_servico as id, razao_social as descricao, razao_social, cnpj 
            from prestador_servico 
            order by razao_social
        `);
    }

    buscarDadosAcesso(id) {
        return this.queryFindOne(`
            select cnpj, senha_aplicativo
            from prestador_servico
            where id_prestador_servico = $1
        `, [id]);
    }

    alterarSenhaAplicativo(id, senhaAplicativo) {
        return this.query(`
            update prestador_servico set senha_aplicativo = $2
            where id_prestador_servico = $1
        `, [id, senhaAplicativo]);
    }

    comboPorUnidadeEscolar(idUnidadeEscolar) {
        return this.queryFindAll(`
            select ps.id_prestador_servico as id, ps.razao_social as descricao, ps.razao_social, ps.cnpj 
            from prestador_servico ps
            join contrato c using (id_prestador_servico)
            join contrato_unidade_escolar cue using (id_contrato)
            where ps.flag_ativo and cue.id_unidade_escolar = $1
        `, [idUnidadeEscolar]);
    }

    comboTodosPorUnidadeEscolar(idUnidadeEscolar) {
        return this.queryFindAll(`
            select ps.id_prestador_servico as id, ps.razao_social as descricao, ps.razao_social, ps.cnpj 
            from prestador_servico ps
            join contrato c using (id_prestador_servico)
            join contrato_unidade_escolar cue using (id_contrato)
            where cue.id_unidade_escolar = $1
        `, [idUnidadeEscolar]);
    }

}

module.exports = PrestadorServicoDao;