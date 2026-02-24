const GenericDao = require('rfr')('core/generic-dao.js');

class AmbienteGeralDao extends GenericDao {

  constructor() {
    super('ambiente_geral');
  }

  buscarPorDescricao(descricao) {

    const sql = `
      select id_ambiente_geral as id, *
      from ambiente_geral
      where unaccent(lower(descricao)) ilike unaccent(lower(trim($1)))`;

    return this.queryFindOne(sql, [descricao]);

  }

  datatable(descricao, idTipoAmbiente, length, start) {

    const sql = `
      select count(*) over() as records_total, ag.id_ambiente_geral as id, ag.descricao, ta.descricao as tipo_ambiente
      from ambiente_geral ag
      join tipo_ambiente ta using (id_tipo_ambiente)
      where ag.flag_ativo and case when $1::TEXT is null then true else ag.descricao ILIKE ('%' || $1::TEXT || '%') end
        and case when $2::int is null then true else ag.id_tipo_ambiente = $2::int end
      order by ag.descricao limit $3 offset $4`;

    return this.queryFindAll(sql, [descricao, idTipoAmbiente, length, start]);

  }

  insert(descricao, idTipoAmbiente) {

    const sql = `
      insert into ambiente_geral (descricao, id_tipo_ambiente) 
      values ($1, $2)`;

    return this.query(sql, [descricao, idTipoAmbiente]);

  }

  atualizar(id, descricao, idTipoAmbiente) {

    const sql = `
      update ambiente_geral set descricao = $1, id_tipo_ambiente = $2 
      where id_ambiente_geral = $3`;

    return this.query(sql, [descricao, idTipoAmbiente, id]);

  }

  remover(id) {

    const sql = `
      update ambiente_geral set flag_ativo = false
      where id_ambiente_geral = $1`;

    return this.query(sql, [id]);

  }

  combo() {

    const sql = `
      select ag.id_ambiente_geral as id, ag.descricao, ta.descricao as tipo_ambiente
      from ambiente_geral ag
      join tipo_ambiente ta using (id_tipo_ambiente)
      where ag.flag_ativo order by ag.descricao`;

    return this.queryFindAll(sql);

  }

}

module.exports = AmbienteGeralDao;