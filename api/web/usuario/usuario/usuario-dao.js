const GenericDao = require('rfr')('core/generic-dao.js');

class UsuarioDao extends GenericDao {

  constructor() {
    super('usuario');
  }

  buscar(id) {

    const sql = `
      select u.id_usuario as id, u.nome, u.email, u.senha, u.id_origem_detalhe,
        u.id_usuario_cargo, uc.id_usuario_origem, u.id_usuario_status, u.url_nomeacao,
        array_remove(array_agg(upue.id_unidade_escolar), null) as unidade_escolar_permissao,
        array_remove(array_agg(usc.id_contrato), null) as contrato_permissao
      from usuario u
      join usuario_cargo uc on uc.id_usuario_cargo = u.id_usuario_cargo
      left join usuario_prestador_unidade_escolar upue on upue.id_usuario = u.id_usuario
      left join usuario_sme_contrato usc on usc.id_usuario = u.id_usuario
      where u.id_usuario = $1
      group by 1,2,3,4,5,6,7,8,9`;

    return this.queryFindOne(sql, [id]);

  }

  comboPorOrigem(idUsuarioOrigem) {

    const sql = `
      select u.id_usuario as id, u.nome, u.email
      from usuario u
      join usuario_status us on us.id_usuario_status = u.id_usuario_status
      join usuario_cargo uc on uc.id_usuario_cargo = u.id_usuario_cargo
      join usuario_origem uo on uo.id_usuario_origem = uc.id_usuario_origem
      where uo.id_usuario_origem = $1 and us.flag_pode_logar
      order by u.nome`;

    return this.queryFindAll(sql, [idUsuarioOrigem]);

  }

  comboContratoPorUsuarioSME(idUsuario) {

    const sql = `
      select c.id_contrato as id, c.descricao, c.codigo
      from usuario_sme_contrato usc
      join contrato c using (id_contrato)
      where usc.id_usuario = $1 
      order by substring(c.codigo from '([0-9]+)')::bigint asc, c.codigo`;

    return this.queryFindAll(sql, [idUsuario]);

  }

  insertContratoUsuarioSME(idUsuario, idContrato, _transaction) {

    const sql = `
      insert into usuario_sme_contrato (id_usuario, id_contrato)
      values ($1, $2)`;

    return this.query(sql, [idUsuario, idContrato], _transaction);

  }

  removerContratoUsuarioSME(idUsuario, _transaction) {

    const sql = `
      delete from usuario_sme_contrato 
      where id_usuario = $1`;

    return this.query(sql, [idUsuario], _transaction);

  }

  findDetalhadoByEmail(email, _transaction) {

    const sql = `
      select u.id_usuario as id, u.nome, u.email, u.senha, u.id_origem_detalhe, u.id_usuario_status,
        json_build_object('id', uc.id_usuario_cargo, 'descricao', uc.descricao) as usuario_cargo, us.flag_pode_logar, 
        json_build_object('id', uo.id_usuario_origem, 'descricao', uo.descricao, 'codigo', uo.codigo) as usuario_origem
      from usuario u
      join usuario_cargo uc on uc.id_usuario_cargo = u.id_usuario_cargo
      join usuario_origem uo on uo.id_usuario_origem = uc.id_usuario_origem
      join usuario_status us on us.id_usuario_status = u.id_usuario_status
      where unaccent(lower(u.email)) ilike unaccent(lower(trim($1)))`;

    return this.queryFindOne(sql, [email], _transaction);

  }

  findDetalhadoById(id) {

    const sql = `
      select u.id_usuario as id, u.nome, u.email, u.senha, u.id_origem_detalhe,
        json_build_object('id', uc.id_usuario_cargo, 'descricao', uc.descricao) as usuario_cargo,
        json_build_object('id', uo.id_usuario_origem, 'descricao', uo.descricao, 'codigo', uo.codigo) as usuario_origem
      from usuario u
      join usuario_cargo uc on uc.id_usuario_cargo = u.id_usuario_cargo
      join usuario_origem uo on uo.id_usuario_origem = uc.id_usuario_origem
      join usuario_status us on us.id_usuario_status = u.id_usuario_status
      where u.id_usuario = $1 and us.flag_pode_logar`;

    return this.queryFindOne(sql, [id]);

  }

  datatable(nome, email, idUsuarioCargo, idOrigemDetalheList, idUsuarioOrigemList, idContratoList, length, start) {

    const sql = `
      select count(u.*) over() as records_total, u.id_usuario as id, u.nome, u.email,
        json_build_object('descricao', us.descricao, 'classe_label', us.classe_label) as usuario_status,
        json_build_object('descricao', uo.descricao, 'codigo', uo.codigo) as usuario_origem,
        json_build_object('descricao', uc.descricao) as usuario_cargo
      from usuario u
      join usuario_status us on us.id_usuario_status = u.id_usuario_status
      join usuario_cargo uc on uc.id_usuario_cargo = u.id_usuario_cargo
      join usuario_origem uo on uo.id_usuario_origem = uc.id_usuario_origem
      left join unidade_escolar ue on ue.id_unidade_escolar = u.id_origem_detalhe and uo.codigo = 'ue'
      left join contrato_unidade_escolar cue on cue.id_unidade_escolar = ue.id_unidade_escolar 
      where case when $1::text is null then true else u.nome ilike ('%' || $1::text || '%') end
        and case when $2::text is null then true else trim(lower(u.email)) = trim(lower($2::text)) end
        and case when $3::int is null then true else u.id_usuario_cargo = $3::int end
        and case when $4::int[] is null then true else u.id_origem_detalhe = any($4::int[]) end
        and uo.id_usuario_origem = any($5::int[])
        and case when $6::int[] is null or uo.codigo <> 'ue' then true else 
          uo.codigo = 'ue' and cue.id_contrato = any($6::int[]) end
      order by u.nome limit $7 offset $8`;

    return this.queryFindAll(sql, [nome, email, idUsuarioCargo, idOrigemDetalheList, idUsuarioOrigemList, idContratoList, length, start]);

  }

  insert(nome, email, hashSenha, idUsuarioStatus, idUsuarioCargo, idOrigemDetalhe, urlNomeacao, _transaction) {

    const sql = `
      insert into usuario (nome, email, senha, id_usuario_status, id_usuario_cargo, id_origem_detalhe, url_nomeacao)
      values ($1, $2, $3, $4, $5, $6, $7)`;

    return this.insertWithReturn(sql, [nome, email, hashSenha, idUsuarioStatus, idUsuarioCargo, idOrigemDetalhe, urlNomeacao], 'id_usuario', _transaction);

  }

  atualizar(id, nome, email, hashSenha, idUsuarioStatus, idUsuarioCargo, idOrigemDetalhe, urlNomeacao, _transaction) {

    const sql = `
      update usuario set nome = $1, email = $2, senha = $3, id_usuario_status = $4, id_usuario_cargo = $5, id_origem_detalhe = $6, url_nomeacao = $7
      where id_usuario = $8`;

    return this.query(sql, [nome, email, hashSenha, idUsuarioStatus, idUsuarioCargo, idOrigemDetalhe, urlNomeacao, id], _transaction);

  }

  insertPrestadorUnidadeEscolar(idUsuario, idUnidadeEscolar, _transaction) {

    const sql = `
      insert into usuario_prestador_unidade_escolar (id_usuario, id_unidade_escolar) 
      values ($1, $2)`;

    return this.query(sql, [idUsuario, idUnidadeEscolar], _transaction);

  }

  insertGestorPrestadorUnidadeEscolar(idPrestadorServico, idUnidadeEscolar, _transaction) {

    const sql = `
      insert into usuario_prestador_unidade_escolar (id_usuario, id_unidade_escolar) 
      select u.id_usuario, $2
      from usuario u 
      where u.id_usuario_cargo = 4 and u.id_origem_detalhe = $1
      on conflict do nothing`;

    return this.query(sql, [idPrestadorServico, idUnidadeEscolar], _transaction);

  }

  removerPrestadorUnidadeEscolar(idUsuario, _transaction) {

    const sql = `
      delete from usuario_prestador_unidade_escolar 
      where id_usuario = $1`;

    return this.query(sql, [idUsuario], _transaction);

  }

  removerPrestadorUnidadeEscolarSemContrato(_transaction) {

    const sql = `
      with remover as (
        select upue.*
        from usuario_prestador_unidade_escolar upue
        left join contrato_unidade_escolar cue on cue.id_unidade_escolar = upue.id_unidade_escolar
        left join contrato c on c.id_contrato = cue.id_contrato
        join usuario u on u.id_usuario = upue.id_usuario
        join usuario_cargo uc on uc.id_usuario_cargo = u.id_usuario_cargo
        join usuario_origem uo on uo.id_usuario_origem = uc.id_usuario_origem 
        where uo.codigo = 'ps' and cue.id_unidade_escolar is null
      )
      delete from usuario_prestador_unidade_escolar upue
      using remover r
      where upue.id_usuario = r.id_usuario and upue.id_unidade_escolar = r.id_unidade_escolar`;

    return this.query(sql, [], _transaction);

  }

  buscarPrestadorPorUnidadeEscolar(idUnidadeEscolar) {

    const sql = `
      select u.* from usuario u
      join usuario_status us on us.id_usuario_status = u.id_usuario_status
      join usuario_prestador_unidade_escolar upue on upue.id_usuario = u.id_usuario
      join prestador_servico ps on ps.id_prestador_servico = u.id_origem_detalhe
      where ps.flag_ativo and us.flag_pode_logar and upue.id_unidade_escolar = $1`;

    return this.queryFindAll(sql, [idUnidadeEscolar]);

  }

  desativar(id) {

    const sql = `
      update usuario 
      set id_usuario_status = 3 
      where id_usuario = $1`;

    return this.query(sql, [id]);

  }

  atualizarSenhaUsuario(id, senha, _transaction) {

    const sql = `
      update usuario 
      set senha = $2 
      where id_usuario = $1`;

    return this.query(sql, [id, senha], _transaction);

  }

  insertRedefinicaoSenha(idUsuario, token) {

    const sql = `
      insert into usuario_recuperacao (id_usuario, token, data_hora_insercao) 
      values ($1, $2, $3)`;

    return this.query(sql, [idUsuario, token, new Date()]);

  }

  findByTokenRecuperacao(token) {

    const sql = `
      select u.id_usuario as id, u.nome, u.email, ur.id_usuario_recuperacao, ur.data_hora_insercao
      from usuario_recuperacao ur
      join usuario u using (id_usuario)
      where ur.token = $1 and data_hora_recuperacao is null`;

    return this.queryFindOne(sql, [token]);

  }

  setarTokenRecuperado(idUsuarioRecuperacao, _transaction) {

    const sql = `
      update usuario_recuperacao 
      set data_hora_recuperacao = $2 
      where id_usuario_recuperacao = $1`;

    return this.query(sql, [idUsuarioRecuperacao, new Date()], _transaction);

  }

}

module.exports = UsuarioDao;