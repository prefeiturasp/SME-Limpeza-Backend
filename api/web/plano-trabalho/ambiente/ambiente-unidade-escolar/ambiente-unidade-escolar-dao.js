const GenericDao = require('rfr')('core/generic-dao.js');

class AmbienteUnidadeEscolarDao extends GenericDao {

  constructor() {
    super('ambiente_unidade_escolar');
  }

  buscarDadosQRCode(id) {

    const sql = `
      select aue.id_ambiente_unidade_escolar as id, aue.hash, aue.descricao, ta.descricao as tipo_ambiente, aue.area_ambiente,
          ue.descricao as unidade_escolar, dr.descricao as diretoria_regional
      from ambiente_unidade_escolar aue
      join ambiente_geral ag on ag.id_ambiente_geral = aue.id_ambiente_geral
      join unidade_escolar ue on ue.id_unidade_escolar = aue.id_unidade_escolar
      join diretoria_regional dr on dr.id_diretoria_regional = ue.id_diretoria_regional
      join tipo_ambiente ta on ta.id_tipo_ambiente = ag.id_tipo_ambiente
      where aue.id_ambiente_unidade_escolar = $1`;

    return this.queryFindOne(sql, [id]);

  }

  buscarPorDescricaoAndAtivo(descricao, _transaction) {

    const sql = `
      select id_ambiente_unidade_escolar as id, *
      from ambiente_unidade_escolar
      where flag_ativo and descricao ilike (trim($1))`;

    return this.queryFindOne(sql, [descricao], _transaction);

  }

  buscarPorHash(hash, idUnidadeEscolar) {

    const sql = `
      select id_ambiente_unidade_escolar as id, *
      from ambiente_unidade_escolar
      where hash = (trim($1)) and id_unidade_escolar = $2::int`;

    return this.queryFindOne(sql, [hash, idUnidadeEscolar]);

  }

  datatable(idUnidadeEscolar, descricao, idTipoAmbiente, idDiretoriaRegional, idContratoList, length, start) {

    const sql = `
      with unidades as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
        where case when $5::int[] is null then true else id_contrato = any($5::int[]) end
      )
      select 
        count(*) over() as records_total, 
        aue.id_ambiente_unidade_escolar as id, 
        aue.descricao, 
        ta.descricao as tipo_ambiente, 
        aue.area_ambiente,
        json_build_object('descricao', ue.descricao, 'codigo', ue.codigo, 'tipo', te.descricao) as unidade_escolar
      from unidades u
      join ambiente_unidade_escolar aue using (id_unidade_escolar)
      join ambiente_geral ag on ag.id_ambiente_geral = aue.id_ambiente_geral
      join unidade_escolar ue on ue.id_unidade_escolar = aue.id_unidade_escolar
      join tipo_ambiente ta on ta.id_tipo_ambiente = ag.id_tipo_ambiente
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      where aue.flag_ativo 
        and case when $1::int is null then true else aue.id_unidade_escolar = $1::int end
        and case when $2::text is null then true else aue.descricao ilike ('%' || $2::text || '%') end
        and case when $3::int is null then true else ag.id_tipo_ambiente = $3::int end
        and case when $4::int is null then true else ue.id_diretoria_regional = $4::int end
      order by ue.descricao, aue.descricao
      limit $6 offset $7`;

    return this.queryFindAll(sql, [idUnidadeEscolar, descricao, idTipoAmbiente, idDiretoriaRegional, idContratoList, length, start]);

  }

  insert(idUnidadeEscolar, idAmbienteGeral, descricao, areaAmbiente, _transaction) {

    const sql = `
      insert into ambiente_unidade_escolar (id_unidade_escolar, id_ambiente_geral, descricao, area_ambiente) 
      values ($1, $2, $3, $4)`;

    return this.insertWithReturn(sql, [idUnidadeEscolar, idAmbienteGeral, descricao, areaAmbiente], 'id_ambiente_unidade_escolar', _transaction);

  }

  atualizar(id, idAmbienteGeral, descricao, areaAmbiente) {

    const sql = `
      update ambiente_unidade_escolar set id_ambiente_geral = $1, descricao = $2, area_ambiente = $3
      where id_ambiente_unidade_escolar = $4`;

    return this.query(sql, [idAmbienteGeral, descricao, areaAmbiente, id]);

  }

  atualizarHash(id, hash, _transaction) {

    const sql = `
      update ambiente_unidade_escolar set hash = $1
      where id_ambiente_unidade_escolar = $2`;

    return this.query(sql, [hash, id], _transaction);

  }

  remover(id) {

    const sql = `
      update ambiente_unidade_escolar set flag_ativo = false 
      where id_ambiente_unidade_escolar = $1`;

    return this.query(sql, [id]);

  }

  removerPorUnidadeEscolar(_transaction, idUnidadeEscolar) {

    const sql = `
      update ambiente_unidade_escolar set flag_ativo = false 
      where id_unidade_escolar = $1`;

    return this.query(sql, [idUnidadeEscolar], _transaction);

  }

  combo(idUnidadeEscolar) {

    const sql = `
      select id_ambiente_unidade_escolar as id, descricao
      from ambiente_unidade_escolar
      where flag_ativo and id_unidade_escolar = $1 
      order by 2`;

    return this.queryFindAll(sql, [idUnidadeEscolar]);

  }

  comboPorAmbienteGeral(idUnidadeEscolar, idAmbienteGeral) {

    const sql = `
      select id_ambiente_unidade_escolar as id, descricao
      from ambiente_unidade_escolar
      where flag_ativo and id_unidade_escolar = $1 and id_ambiente_geral = $2
      order by 2`;

    return this.queryFindAll(sql, [idUnidadeEscolar, idAmbienteGeral]);

  }

}

module.exports = AmbienteUnidadeEscolarDao;