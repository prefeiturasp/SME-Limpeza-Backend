const GenericDao = require('rfr')('core/generic-dao.js');

class RelatorioGerencialDao extends GenericDao {

  constructor() {
    super('relatorio_gerencial');
  }

  buscarRelatoriosUnidadeEscolar(idContrato, idPrestadorServico, anos = []) {
    return this.queryFindAll(`
      with meses as (
        select
          EXTRACT(YEAR from m.data) as ano,
          EXTRACT(MONTH from m.data) as mes
        from (
          select
            generate_series(
              (select MIN(data_inicial) from contrato where id_contrato = $1),
              (select case when current_date <= MAX(data_final) THEN current_date ELSE MAX(data_final) end from contrato where id_contrato = $1) + INTERVAL '1 month',
              INTERVAL '1 month'::interval
            )::date as data
          ) as m
        where ($3::int[] is null or cardinality($3::int[]) = 0 or EXTRACT(YEAR from m.data) = ANY($3::int[]))
      ),
      unidades as (
        select distinct ue.descricao, ue.id_unidade_escolar, te.descricao as tipo, ue.codigo
        from unidade_escolar ue
        join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
        join contrato_unidade_escolar cue on cue.id_unidade_escolar = ue.id_unidade_escolar
        where cue.id_contrato = $1
      ),
      dados as (
        select
          m.ano,
          m.mes,
          u.id_unidade_escolar,
          COALESCE(rg.pontuacao_final, 0) as pontuacao_final
        from meses m
        CROSS join unidades u
        left join relatorio_gerencial rg
          on rg.mes = m.mes
        and rg.ano = m.ano
        and rg.id_unidade_escolar = u.id_unidade_escolar
        where rg.id_contrato = $1
          and ( $2::int is null or rg.id_prestador_servico = $2::int )
      )
      select
        m.ano || '/' || m.mes as data,
        json_build_object('id', u.id_unidade_escolar, 'descricao', u.descricao, 'codigo', u.codigo, 'tipo', u.tipo) as unidade_escolar,
        d.pontuacao_final
      from meses m
      CROSS join unidades u
      left join dados d
        on d.mes = m.mes
      and d.ano = m.ano
      and d.id_unidade_escolar = u.id_unidade_escolar
      order by u.descricao, m.ano, m.mes desc;
    `, [idContrato, idPrestadorServico, anos]);
  }

  datatable(idPrestadorServico, idUnidadeEscolar, idContratoList, idDiretoriaRegional, anoReferencia, length, start) {
    return this.queryFindAll(`
      with dados as (
        select
          rg.id_contrato,
          rg.id_prestador_servico,
          c.descricao,
          c.codigo,
          c.data_final,
          rg.ano
        from relatorio_gerencial rg
        join contrato c using (id_contrato)
        join unidade_escolar ue using (id_unidade_escolar)
        where
          case when $1::int   is null then true else c.id_prestador_servico   = $1::int end
      and case when $2::int   is null then true else rg.id_unidade_escolar    = $2::int end
      and case when $3::int[] is null then true else c.id_contrato            = any($3::int[]) end
      and case when $4::int   is null then true else ue.id_diretoria_regional = $4::int end
      and case when $5::int[] is null then true else rg.ano                   = any($5::int[]) end
        group by 1,2,3,4,5,6
      )
      select 
        count(d.*) over() as records_total,
        d.id_contrato,
        d.ano,
        json_build_object('codigo', d.codigo, 'descricao', d.descricao, 'data_final', d.data_final) as contrato,
        json_build_object('razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico,
        case 
          when d.data_final is not null and d.data_final < now()::date then false
          else true
        end as status
      from dados d
      join prestador_servico ps using (id_prestador_servico)
      order by d.ano desc, d.id_contrato asc
      limit $6 offset $7;
        `, [idPrestadorServico, idUnidadeEscolar, idContratoList, idDiretoriaRegional, anoReferencia, length, start]);
  }

}

module.exports = RelatorioGerencialDao;