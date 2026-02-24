const GenericDao = require('rfr')('core/generic-dao.js');

class RelatorioGerencialDao extends GenericDao {

  constructor() {
    super('relatorio_gerencial');
  }

  buscarRelatoriosUnidadeEscolar(anoReferencia, mesReferencia, idContrato, idPrestadorServico) {
    return this.queryFindAll(`
select 
    rg.id_relatorio_gerencial,
    rg.pontuacao_final,
    rg.fator_desconto, 
    rg.valor_bruto, 
    rg.valor_liquido,
    rg.desconto_glosa_rh,
    (rg.valor_bruto * (coalesce(rg.fator_desconto, 0) / 100)) as valor_desconto, 
    (rg.data_hora_aprovacao_fiscal is not null and rg.id_usuario_aprovacao_fiscal is not null) as flag_aprovado_fiscal,
    (rg.data_hora_aprovacao_dre    is not null and rg.id_usuario_aprovacao_dre    is not null) as flag_aprovado_dre,
    u.nome as nome_fiscal_aprovacao,
    json_build_object(
        'id', ue.id_unidade_escolar,
        'descricao', ue.descricao,
        'codigo', ue.codigo,
        'tipo', te.descricao
    ) as unidade_escolar,
    coalesce(rge_tot.quantidade_ausente_total, 0) as quantidade_ausente_total,

    -- novo campo: itens da relatorio_gerencial_equipe por cargo
    coalesce(rge_itens.quantidade_equipe_total, '[]'::json) as quantidade_equipe_total

from relatorio_gerencial rg
join unidade_escolar ue using (id_unidade_escolar)
join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
left join usuario u on u.id_usuario = rg.id_usuario_aprovacao_fiscal

-- total de ausências (já existente)
left join (
    select 
        id_relatorio_gerencial,
        sum(coalesce(quantidade_ausente, 0)) as quantidade_ausente_total
    from relatorio_gerencial_equipe
    group by id_relatorio_gerencial
) rge_tot on rge_tot.id_relatorio_gerencial = rg.id_relatorio_gerencial

-- NOVO: agrega itens por id_cargo em um array JSON
left join (
    select
        rge.id_relatorio_gerencial,
        json_agg(
            json_build_object(
                'id_cargo', rge.id_cargo,
                'descricao', rge.descricao,
                'quantidade_contratada', rge.quantidade_contratada,
                'valor_mensal', rge.valor_mensal,
                'quantidade_ausente', coalesce(rge.quantidade_ausente, 0),
                'valor_desconto', coalesce(rge.valor_desconto, 0)
            )
            order by rge.id_cargo
        ) as quantidade_equipe_total
    from relatorio_gerencial_equipe rge
    group by rge.id_relatorio_gerencial
) rge_itens on rge_itens.id_relatorio_gerencial = rg.id_relatorio_gerencial

where rg.ano = $1
  and rg.mes = $2
  and rg.id_contrato = $3
  and case when $4::int is null then true else rg.id_prestador_servico = $4::int end
order by ue.descricao;
    `, [anoReferencia, mesReferencia, idContrato, idPrestadorServico]);
  }

  datatable(idPrestadorServico, idUnidadeEscolar, ano, mes, idContratoList, idDiretoriaRegional, length, start) {
    return this.queryFindAll(`
      with dados as (
        select
          rg.ano,
          rg.mes,
          rg.id_contrato,
          rg.id_prestador_servico,
          c.descricao,
          c.codigo,
          coalesce(sum(rg.valor_bruto), 0) as valor_total,
          coalesce(sum(rg.valor_liquido), 0) as valor_liquido
        from relatorio_gerencial rg
        join contrato c on c.id_contrato = rg.id_contrato
        join unidade_escolar ue on ue.id_unidade_escolar = rg.id_unidade_escolar
        where
          case when $1::int is null then true else rg.id_prestador_servico = $1::int end
          and case when $2::int is null then true else rg.id_unidade_escolar = $2::int end
          and case when $3::int is null then true else rg.ano = $3::int end
          and case when $4::int is null then true else rg.mes = $4::int end
          and case when $5::int[] is null then true else rg.id_contrato = any($5::int[]) end
          and case when $6::int is null then true else ue.id_diretoria_regional = $6::int end
        group by 1, 2, 3, 4, 5, 6
        order by 1, 2, substring(c.codigo from '([0-9]+)')::bigint asc, c.codigo
      )
      select 
        count(d) over() as records_total,
        d.id_contrato,
        d.id_prestador_servico,
        d.ano,
        to_char(d.mes, 'fm00') as mes,
        d.valor_total,
        d.valor_liquido,
        json_build_object('codigo', d.codigo, 'descricao', d.descricao) as contrato,
        json_build_object('razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
      from dados d
      join prestador_servico ps using (id_prestador_servico)
      order by d.ano desc, d.mes desc
      limit $7 offset $8
    `, [idPrestadorServico, idUnidadeEscolar, ano, mes, idContratoList, idDiretoriaRegional, length, start]);
  }

}

module.exports = RelatorioGerencialDao;