const GenericDao = require('rfr')('core/generic-dao.js');

class OcorrenciaRetroativaDao extends GenericDao {

    constructor() {
        super('ocorrencia_retroativa');
    }

    comboTodasUesPorIdContrato(idsContratos) {

      const sql = `select c.id_contrato, ue.id_unidade_escolar as id, ue.descricao, ue.codigo, te.descricao as tipo
                from unidade_escolar ue
                join tipo_escola te using (id_tipo_escola)
                join contrato_unidade_escolar cue on (cue.id_unidade_escolar = ue.id_unidade_escolar)
                join contrato c on (c.id_contrato = cue.id_contrato)
                WHERE c.id_contrato = ANY($1)
                order by ue.descricao`;

      return this.queryFindAll(sql, [idsContratos]);

    }

    cadastrarOcorrenciaRetroativa(dados, idUsuario) {

      let qtdContratos = dados.contratoList.length;
      let qtdUes = dados.unidadeEscolarList.length;

      let dataInicial = dados.dataInicial;
      let dataFinal = dados.dataFinal;
      let motivo = dados.motivo;
      let result = [];
      for (let i = 0; i < qtdContratos; i++) {
        
        let idContrato = dados.contratoList[i];
        for (let j = 0; j < qtdUes; j++) {
            if(dados.unidadeEscolarList[j].idContrato === idContrato){
              const sql = `insert into ocorrencia_retroativa (id_contrato, id_unidade_escolar, data_inicial, data_final, id_usuario, motivo) values ($1, $2, $3, $4, $5, $6)`;
              result.push(this.query(sql, [idContrato, dados.unidadeEscolarList[j].id, dataInicial, dataFinal, idUsuario, motivo]));
            }
        }
      }

      return result;

    }


    datatable(params, dataInicial, dataFinal, idContrato, idUnidadeEscolar) {

      const sql = `select count(*) over() as records_total, ocr.id_contrato, ocr.id_ocorrencia_retroativa, ocr.id_ocorrencia, ue.descricao, ocr.data_hora_criacao, c.codigo, ocr.id_unidade_escolar, ocr.data_inicial, ocr.data_final, ocr.id_usuario, ocr.id_prestador_servico, ocr.status_ocorrencia_retroativa
      from ocorrencia_retroativa as ocr 
      join contrato c ON ocr.id_contrato = c.id_contrato
      join unidade_escolar ue ON ue.id_unidade_escolar = ocr.id_unidade_escolar
      where 
        ($1::date is null or ocr.data_inicial::date >= $1::date)
        and ($2::date is null or ocr.data_final::date <= $2::date)
        and ($5::int is null or ocr.id_contrato = $5::int)
        and ($6::int is null or ocr.id_unidade_escolar = $6::int)
      order by ocr.data_hora_criacao desc
      limit $3 offset $4`;

      return this.queryFindAll(sql, [dataInicial, dataFinal, params.length, params.start, idContrato, idUnidadeEscolar]);

    }

    buscaDataOcorrenciaRetroativa(idUnidadeEscolar) {

      const sql = `select id_ocorrencia_retroativa, TO_CHAR(data_inicial, 'YYYY-MM-DD') as data_inicial, TO_CHAR(data_final, 'YYYY-MM-DD') as data_final, TO_CHAR(data_inicial, 'HH24:MI') as hora_inicial, TO_CHAR(data_final, 'HH24:MI') as hora_final, AGE(data_final, data_inicial) as periodo_dias  
      from ocorrencia_retroativa 
      where id_unidade_escolar = $1 AND status_ocorrencia_retroativa = 'A'`;

      return this.queryFindAll(sql, [idUnidadeEscolar]);
    }

    buscaDetalhesOcorrenciaRetroativa(idOcorrenciaRetroativa) {

      const sql = `select ocr.id_ocorrencia, ocr.id_contrato, c.descricao as dre, c.codigo, ue.descricao, ocr.data_inicial, ocr.data_final, u.nome as usuario, ocr.motivo, ups.nome as prestador_servico, ocr.status_ocorrencia_retroativa, ocr.data_hora_criacao
      from ocorrencia_retroativa as ocr 
      join contrato c ON ocr.id_contrato = c.id_contrato
      join unidade_escolar ue ON ue.id_unidade_escolar = ocr.id_unidade_escolar
      join usuario u ON ocr.id_usuario = u.id_usuario
      left join usuario ups ON ups.id_usuario = ocr.id_prestador_servico
      where ocr.id_ocorrencia_retroativa = $1`;

      return this.queryFindAll(sql, [idOcorrenciaRetroativa]);
    }

}

module.exports = OcorrenciaRetroativaDao;