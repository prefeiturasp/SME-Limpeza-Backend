const GenericDao = require('rfr')('core/generic-dao.js');

class RelatorioOcorrenciaFuncionarioDao extends GenericDao {

  constructor() {
    super('');
  }

  datatable(idUnidadeEscolar, dataInicial, dataFinal, length, start) {
    return this.queryFindAll(`
      with dados as (
        select o.id_ocorrencia, o.data, oe.id_cargo, oe.quantidade_contratada, oe.valor_mensal, oe.quantidade_presente, o.id_unidade_escolar
        from ocorrencia o 
        join ocorrencia_equipe oe using (id_ocorrencia)
        where o.data::DATE BETWEEN $2::DATE and $3::DATE
          and case when $1::int is null then true else o.id_unidade_escolar = $1::int end
      )
      select 
        count(d.*) over() as records_total,
        d.id_ocorrencia,
        d.data,
        c.descricao as cargo,
        d.quantidade_contratada,
        d.valor_mensal,
        d.quantidade_presente,
        (d.quantidade_contratada - d.quantidade_presente) as quantidade_ausente,
        (d.valor_mensal * (d.quantidade_contratada - d.quantidade_presente)) as valor,
        TO_JSON(ue) as unidade_escolar
      from dados d
      join cargo c using (id_cargo)
      join unidade_escolar ue on ue.id_unidade_escolar = d.id_unidade_escolar
      order by d.data, ue.descricao, c.descricao
      limit $4 offset $5
    `, [idUnidadeEscolar, dataInicial, dataFinal, length, start]);
  }

}

module.exports = RelatorioOcorrenciaFuncionarioDao;