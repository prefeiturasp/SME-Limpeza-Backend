const GenericDao = require('rfr')('core/generic-dao.js');

class RelatorioEquipeContratoDao extends GenericDao {

  constructor() {
    super('');
  }

  datatable(ano, mes, idContratoList, length, start) {

    const sql = `
      with filtered_data as (
        select
          rg.id_contrato,
          rg.id_prestador_servico,
          rg.mes,
          rg.ano,
          rg.id_unidade_escolar,
          sum(coalesce(rge.quantidade_contratada, 0)) as quantidade_contratada,
          sum(coalesce(rge.quantidade_ausente, 0)) as quantidade_ausente,
          (100.0 * sum(rge.quantidade_ausente)) / nullif(sum(rge.quantidade_contratada) * 21.74, 0) as percentual_ausencia
        from relatorio_gerencial rg
        left join relatorio_gerencial_equipe rge on rge.id_relatorio_gerencial = rg.id_relatorio_gerencial
        where
          case when $1::int is null then true else rg.ano = $1::int end
          and case when $2::int is null then true else rg.mes = $2::int end
          and case when $3::int[] is null then true else rg.id_contrato = any($3::int[]) end
        group by 1, 2, 3, 4, 5
      ),
      aggregated_data as (
         select
          fd.id_contrato,
          fd.id_prestador_servico,
          fd.mes,
          fd.ano,
          count(fd) as quantidade_unidades_escolar,
          sum(fd.quantidade_contratada) as quantidade_contratada,
          sum(fd.quantidade_ausente) as quantidade_ausente,
          avg(fd.percentual_ausencia) as percentual_ausencia,
          case 
            when avg(fd.percentual_ausencia) >= 9 then 3
            when avg(fd.percentual_ausencia) >= 5 then 2
            else 0
          end as percentual_multa
        from filtered_data fd
        group by 1, 2, 3, 4
      )
      select
        count(*) over () as records_total,
        c.codigo,
        c.descricao,
        to_char(ad.mes, 'fm00') as mes,
        ad.ano,
        ad.quantidade_unidades_escolar,
        json_build_object('razao_social', razao_social, 'cnpj', cnpj) as prestador_servico,
        ad.quantidade_contratada,
        ad.quantidade_contratada * 21.74 as quantidade_contratada_mensal,
        ad.quantidade_ausente,
        coalesce(ad.percentual_ausencia, 0) as percentual_ausencia,
        coalesce(ad.percentual_multa, 0) as percentual_multa
      from aggregated_data ad
      join prestador_servico ps on ps.id_prestador_servico = ad.id_prestador_servico
      join contrato c on c.id_contrato = ad.id_contrato
      order by ano desc, mes desc, substring(c.codigo from '([0-9]+)')::bigint asc, c.codigo
      limit $4 offset $5`;

    return this.queryFindAll(sql, [ano, mes, idContratoList, length, start]);

  }

  exportar(ano, mes, idContratoList) {

    const sql = `
      with filtered_data as (
        select
          rg.id_contrato,
          rg.id_prestador_servico,
          rg.mes,
          rg.ano,
          rg.id_unidade_escolar,
          sum(coalesce(rge.quantidade_contratada, 0)) as quantidade_contratada,
          sum(coalesce(rge.quantidade_ausente, 0)) as quantidade_ausente,
          (100.0 * sum(rge.quantidade_ausente)) / nullif(sum(rge.quantidade_contratada) * 21.74, 0) as percentual_ausencia
        from relatorio_gerencial rg
        left join relatorio_gerencial_equipe rge on rge.id_relatorio_gerencial = rg.id_relatorio_gerencial
        where
          case when $1::int is null then true else rg.ano = $1::int end
          and case when $2::int is null then true else rg.mes = $2::int end
          and case when $3::int[] is null then true else rg.id_contrato = any($3::int[]) end
        group by 1, 2, 3, 4, 5
      ),
      aggregated_data as (
         select
          fd.id_contrato,
          fd.id_prestador_servico,
          fd.mes,
          fd.ano,
          count(fd) as quantidade_unidades_escolar,
          sum(fd.quantidade_contratada) as quantidade_contratada,
          sum(fd.quantidade_ausente) as quantidade_ausente,
          avg(fd.percentual_ausencia) as percentual_ausencia,
          case 
            when avg(fd.percentual_ausencia) >= 9 then 3
            when avg(fd.percentual_ausencia) >= 5 then 2
            else 0
          end as percentual_multa
        from filtered_data fd
        group by 1, 2, 3, 4
      )
      select
        count(*) over () as records_total,
        c.codigo,
        c.descricao,
        to_char(ad.mes, 'fm00') as mes,
        ad.ano,
        ad.quantidade_unidades_escolar,
        json_build_object('razao_social', razao_social, 'cnpj', cnpj) as prestador_servico,
        ad.quantidade_contratada,
        ad.quantidade_contratada * 21.74 as quantidade_contratada_mensal,
        ad.quantidade_ausente,
        coalesce(ad.percentual_ausencia, 0) as percentual_ausencia,
        coalesce(ad.percentual_multa, 0) as percentual_multa
      from aggregated_data ad
      join prestador_servico ps on ps.id_prestador_servico = ad.id_prestador_servico
      join contrato c on c.id_contrato = ad.id_contrato
      order by ano desc, mes desc, substring(c.codigo from '([0-9]+)')::bigint asc, c.codigo`;

    return this.queryFindAll(sql, [ano, mes, idContratoList]);

  }

}

module.exports = RelatorioEquipeContratoDao;