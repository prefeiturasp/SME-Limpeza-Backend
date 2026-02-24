const GenericDao = require('rfr')('core/generic-dao.js');

class PlanoTrabalhoMatrizDao extends GenericDao {

    constructor() {
        super('plano_trabalho_matriz');
    }

    buscarPorAmbienteGeralPeriodicidadeTurno(idAmbienteGeral, idPeriodicidade, idTurno) {
        return this.queryFindOne(`
            select * from plano_trabalho_matriz
            where flag_ativo and id_ambiente_geral = $1 and id_periodicidade = $2 and id_turno  = $3
        `, [idAmbienteGeral, idPeriodicidade, idTurno]);
    }

    datatable(idPeriodicidade, idAmbienteGeral, idTipoAmbiente, length, start) {
        return this.queryFindAll(`
            select count(*) over() as records_total, pt.id_plano_trabalho_matriz as id, TO_JSONB(t) as turno, TO_JSONB(p) as periodicidade, pt.descricao, ag.descricao as ambiente, ta.descricao as tipo_ambiente
            from plano_trabalho_matriz pt
            join ambiente_geral ag using (id_ambiente_geral)
            join tipo_ambiente ta using (id_tipo_ambiente)
            join turno t on t.id_turno = pt.id_turno
            join periodicidade p on p.id_periodicidade = pt.id_periodicidade
            where pt.flag_ativo 
                and case when $1::int is null then true else pt.id_periodicidade  = $1::int end
                and case when $2::int is null then true else pt.id_ambiente_geral = $2::int end
                and case when $3::int is null then true else ag.id_tipo_ambiente  = $3::int end
            order by ag.descricao limit $4 offset $5
        `, [idPeriodicidade, idAmbienteGeral, idTipoAmbiente, length, start]);
    }

    insert(_transaction, descricao, idPeriodicidade, idAmbienteGeral, idTurno) {
        return this.query(`
            insert into plano_trabalho_matriz (descricao, id_periodicidade, id_ambiente_geral, id_turno) 
            values ($1, $2, $3, $4)
        `, [descricao, idPeriodicidade, idAmbienteGeral, idTurno], _transaction);
    }

    atualizar(id, descricao, idPeriodicidade, idAmbienteGeral, idTurno) {
        return this.query(`
            update plano_trabalho_matriz set descricao = $1, id_periodicidade = $2, id_ambiente_geral = $3, id_turno = $4
            where id_plano_trabalho_matriz = $5
        `, [descricao, idPeriodicidade, idAmbienteGeral, idTurno, id]);
    }

    remover(id) {
        return this.query(`
            update plano_trabalho_matriz set flag_ativo = false 
            where id_plano_trabalho_matriz = $1
        `, [id]);
    }

    comboUnidadeEscolar(idUnidadeEscolar) {
        return this.queryFindAll(`
            select distinct(ptm.id_plano_trabalho_matriz) as id, TO_JSONB(t) as turno, TO_JSONB(p) as periodicidade, 
                ptm.descricao, TO_JSONB(ag) as ambiente_geral, ta.descricao as tipo_ambiente
            from plano_trabalho_matriz ptm 
            join ambiente_geral ag using (id_ambiente_geral)
            join ambiente_unidade_escolar aue using (id_ambiente_geral)
            join tipo_ambiente ta on ta.id_tipo_ambiente = ag.id_tipo_ambiente
            join turno t on t.id_turno = ptm.id_turno
            join periodicidade p on p.id_periodicidade = ptm.id_periodicidade
            where ptm.flag_ativo and aue.flag_ativo and aue.id_unidade_escolar = $1
        `, [idUnidadeEscolar]);
    }

}

module.exports = PlanoTrabalhoMatrizDao;