const GenericDao = require('rfr')('core/generic-dao.js');

class OcorrenciaTipoDao extends GenericDao {

    constructor() {
        super('ocorrencia_tipo');
    }

    buscar(id) {
        return this.queryFindOne(`
            select 
                ot.id_ocorrencia_tipo as id, 
                ot.descricao, 
                ot.flag_apenas_monitoramento, 
                ot.peso,
                ot.contrato_modelo,
                array_agg(to_json(ov) order by ov.peso desc) as variaveis
            from ocorrencia_tipo ot
            join ocorrencia_variavel ov USING(id_ocorrencia_tipo)
            where ot.flag_ativo and ot.id_ocorrencia_tipo = $1
            group by 1, 2, 3, 4, 5
        `, [id]);
    }

    combo(flagSomenteCadastro) {
        return this.queryFindAll(`
            select 
                ot.id_ocorrencia_tipo as id, 
                ('M' || ot.contrato_modelo || ' - ' || ot.descricao) as descricao, 
                ot.flag_apenas_monitoramento, 
                ot.peso,
                ot.contrato_modelo,
                count(ov) as variaveis
            from ocorrencia_tipo ot
            left join ocorrencia_variavel ov using (id_ocorrencia_tipo)
            where ot.flag_ativo 
                and case when $1 
                    THEN not ot.flag_apenas_monitoramento 
                    ELSE TRUE 
                end
            group by 1, 2, 3, 4, 5
            order by ot.contrato_modelo, ot.peso desc
        `, [flagSomenteCadastro]);
    }

    remover(_transaction, id) {
        return this.query(`
            update ocorrencia_tipo set flag_ativo = false
            where id_ocorrencia_tipo = $1
        `, [id], _transaction);
    }

    insert(_transaction, descricao, peso, flagApenasMonitoramento) {
        return this.insertWithReturn(`
            insert into ocorrencia_tipo (descricao, peso, flag_apenas_monitoramento, flag_ativo)
            values ($1, $2, $3, $4)
        `, [descricao, peso, flagApenasMonitoramento, true], 'id_ocorrencia_tipo', _transaction);
    }

}

module.exports = OcorrenciaTipoDao;