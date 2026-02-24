const GenericDao = require('rfr')('core/generic-dao.js');

class RelatorioEquipeDao extends GenericDao {

  constructor() {
    super('');
  }

  datatable(idUnidadeEscolar, ano, mes, length, start, idContratoList) {

    const sql = `
      with filtered_data as (
        select
          rg.id_relatorio_gerencial,
          rg.id_unidade_escolar,
          rg.id_prestador_servico,
          rg.mes,
          rg.ano,
          sum(coalesce(rge.quantidade_contratada, 0)) as quantidade_contratada,
          sum(coalesce(rge.quantidade_ausente, 0)) as quantidade_ausente
        from relatorio_gerencial rg
        left join relatorio_gerencial_equipe rge on rge.id_relatorio_gerencial = rg.id_relatorio_gerencial
        where
            case when $1::int is null then true else rg.id_unidade_escolar = $1::int end
            and case when $2::int is null then true else rg.ano = $2::int end
            and case when $3::int is null then true else rg.mes = $3::int end
            and case when $4::int[] is null then true else rg.id_contrato = any($4::int[]) end
        group by 1, 2, 3, 4, 5
      )
      select
        count(*) over () as records_total,
        fd.id_relatorio_gerencial as id,
        to_char(fd.mes, 'fm00') as mes,
        fd.ano,
        json_build_object('codigo', ue.codigo, 'descricao', ue.descricao, 'tipo', te.descricao) as unidade_escolar,
        json_build_object('razao_social', razao_social, 'cnpj', cnpj) as prestador_servico,
        fd.quantidade_contratada,
        fd.quantidade_contratada * 21.74 as quantidade_contratada_mensal,
        fd.quantidade_ausente,
        case when fd.quantidade_contratada = 0 then 0 else (100.0 * fd.quantidade_ausente) / (fd.quantidade_contratada * 21.74) end as percentual_ausencia
      from filtered_data fd
      join prestador_servico ps on ps.id_prestador_servico = fd.id_prestador_servico
      join unidade_escolar ue on ue.id_unidade_escolar = fd.id_unidade_escolar
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      order by ano desc, mes desc, ue.descricao
      limit $5 offset $6`;

    return this.queryFindAll(sql, [idUnidadeEscolar, ano, mes, idContratoList, length, start]);

  }

  exportar(idUnidadeEscolar, ano, mes, idContratoList) {

    const sql = `
      with filtered_data as (
        select
          rg.id_relatorio_gerencial,
          rg.id_unidade_escolar,
          rg.id_prestador_servico,
          rg.mes,
          rg.ano,
          sum(coalesce(rge.quantidade_contratada, 0)) as quantidade_contratada,
          sum(coalesce(rge.quantidade_ausente, 0)) as quantidade_ausente
        from relatorio_gerencial rg
        left join relatorio_gerencial_equipe rge on rge.id_relatorio_gerencial = rg.id_relatorio_gerencial
        where
            case when $1::int is null then true else rg.id_unidade_escolar = $1::int end
            and case when $2::int is null then true else rg.ano = $2::int end
            and case when $3::int is null then true else rg.mes = $3::int end
            and case when $4::int[] is null then true else rg.id_contrato = any($4::int[]) end
        group by 1, 2, 3, 4, 5
      )
      select
        to_char(fd.mes, 'fm00') as mes,
        fd.ano,
        json_build_object('codigo', ue.codigo, 'descricao', ue.descricao, 'tipo', te.descricao) as unidade_escolar,
        json_build_object('razao_social', razao_social, 'cnpj', cnpj) as prestador_servico,
        fd.quantidade_contratada,
        fd.quantidade_contratada * 21.74 as quantidade_contratada_mensal,
        fd.quantidade_ausente,
        case when fd.quantidade_contratada = 0 then 0 else (100.0 * fd.quantidade_ausente) / (fd.quantidade_contratada * 21.74) end as percentual_ausencia
      from filtered_data fd
      join prestador_servico ps on ps.id_prestador_servico = fd.id_prestador_servico
      join unidade_escolar ue on ue.id_unidade_escolar = fd.id_unidade_escolar
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      order by ano desc, mes desc, ue.descricao`;

    return this.queryFindAll(sql, [idUnidadeEscolar, ano, mes, idContratoList]);

  }

}

module.exports = RelatorioEquipeDao;