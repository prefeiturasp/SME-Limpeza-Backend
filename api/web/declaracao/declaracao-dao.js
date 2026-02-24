const GenericDao = require('rfr')('core/generic-dao.js');

class ContratoDao extends GenericDao {

  constructor() {
    super('declaracao');
  }

  buscar(data, idUnidadeEscolar) {

    const sql = `
      select * from declaracao
      where data::date = $1::date and id_unidade_escolar = $2`;

    return this.queryFindAll(sql, [data, idUnidadeEscolar]);

  }

  datatable(dataInicial, dataFinal, idUnidadeEscolar, idContratoList, idDiretoriaRegional, length, start) {

    const sql = `
      with unidades as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
        where case when $4::int[] is null then true else id_contrato = any($4::int[]) end
          and case when $3::int is null then true else id_unidade_escolar = $3::int end
      ),
      atividades as (
        select m.data, m.id_unidade_escolar
        from unidades u
        join monitoramento m using (id_unidade_escolar)
        where m.flag_ativo and m.data between $1::date and $2::date
        group by 1, 2
      )
      select 
        count(a.*) over() as records_total,
        a.data,
        d.data is not null as flag_fiscalizado,
        d.data_hora_cadastro,
        u.nome as nome_fiscal,
        json_build_object('descricao', ue.descricao, 'codigo', ue.codigo, 'tipo', te.descricao) as unidade_escolar
      from atividades a
      join unidade_escolar ue using (id_unidade_escolar)
      join tipo_escola te using(id_tipo_escola)
      left join declaracao d on d.id_unidade_escolar = a.id_unidade_escolar and d.data::date = a.data
      left join usuario u on u.id_usuario = d.id_usuario
      where case when $5::int is null then true else ue.id_diretoria_regional = $5::int end
      order by a.data desc, ue.descricao
      limit $6 offset $7`;

    return this.queryFindAll(sql, [dataInicial, dataFinal, idUnidadeEscolar, idContratoList, idDiretoriaRegional, length, start]);

  }

  insert(data, dataHoraCadastro, idUnidadeEscolar, idUsuario) {

    const sql = `
      insert into declaracao (data, data_hora_cadastro, id_unidade_escolar, id_usuario) 
      values ($1, $2, $3, $4)`;

    return this.query(sql, [data, dataHoraCadastro, idUnidadeEscolar, idUsuario]);

  }

}

module.exports = ContratoDao;