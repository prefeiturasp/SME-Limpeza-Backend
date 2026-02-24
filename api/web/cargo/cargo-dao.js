const GenericDao = require('rfr')('core/generic-dao.js');

class CargoDao extends GenericDao {

  constructor() {
    super('cargo');
  }

  buscarVinculoContrato(idCargo) {

    const sql = `
      select * from contrato_equipe
      where id_cargo = $1`;

    return this.queryFindAll(sql, [idCargo]);

  }

  buscarPorDescricaoAndAtivo(descricao) {

    const sql = `
      select id_cargo as id, * from cargo
      where flag_ativo and unaccent(lower(descricao)) ilike unaccent(lower(trim($1)))`;

    return this.queryFindOne(sql, [descricao]);

  }

  datatable(length, start) {

    const sql = `
      select count(*) over() as records_total, id_cargo as id, descricao
      from cargo
      where flag_ativo
      order by descricao limit $1 offset $2`;

    return this.queryFindAll(sql, [length, start]);

  }

  insert(descricao) {

    const sql = `
      insert into cargo (descricao) 
      values ($1)`;

    return this.query(sql, [descricao]);

  }

  remover(id) {

    const sql = `
      update cargo set flag_ativo = false 
      where id_cargo = $1`;

    return this.query(sql, [id]);

  }

  combo() {

    const sql = `
      select id_cargo as id, descricao 
      from cargo where flag_ativo
      order by descricao`;

    return this.queryFindAll(sql);

  }

  comboTodos() {

    const sql = `
      select id_cargo as id, descricao, flag_ativo
      from cargo order by descricao`;

    return this.queryFindAll(sql);

  }

}

module.exports = CargoDao;