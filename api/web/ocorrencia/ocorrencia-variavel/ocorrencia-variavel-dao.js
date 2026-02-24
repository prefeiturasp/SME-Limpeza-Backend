const GenericDao = require('rfr')('core/generic-dao.js');

class OcorrenciaVariavelDao extends GenericDao {

    constructor() {
        super('ocorrencia_variavel');
    }

    combo(flagApenasMonitoramento, contratoModelo) {
        return this.queryFindAll(`
            select ov.id_ocorrencia_variavel as id, 
                ('M' || ot.contrato_modelo || ' - ' || ov.descricao) as descricao, ov.descricao_conforme, 
                ov.descricao_conforme_com_ressalva, ov.descricao_nao_conforme, ov.peso, ov.flag_equipe_alocada
            from ocorrencia_variavel ov
            join ocorrencia_tipo ot using (id_ocorrencia_tipo)
            where ot.flag_ativo
                and ot.contrato_modelo = $2
                and case when $1::BOOLEAN 
                    THEN ot.flag_apenas_monitoramento 
                    ELSE not ot.flag_apenas_monitoramento 
                end
            order by ot.peso desc, ov.peso desc
        `, [flagApenasMonitoramento, contratoModelo]);
    }

    insert(_transaction, idOcorrenciaTipo, descricao, peso, descricaoConforme, descricaoConformeComRessalva, descricaoNaoConforme) {
        return this.query(`
            insert into ocorrencia_variavel (
                id_ocorrencia_tipo, 
                descricao, 
                peso,
                descricao_conforme,
                descricao_conforme_com_ressalva,
                descricao_nao_conforme
            ) values ($1, $2, $3, $4, $5, $6)
        `, [idOcorrenciaTipo, descricao, peso, descricaoConforme, descricaoConformeComRessalva, descricaoNaoConforme], _transaction);
    }

}

module.exports = OcorrenciaVariavelDao;