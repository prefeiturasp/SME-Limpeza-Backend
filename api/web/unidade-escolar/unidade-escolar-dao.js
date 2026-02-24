const GenericDao = require('rfr')('core/generic-dao.js');

class UnidadeEscolarDao extends GenericDao {

  constructor() {
    super('unidade_escolar');
  }

  buscar(id) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.descricao, ue.codigo, te.descricao as tipo
      from unidade_escolar ue
      join tipo_escola te using (id_tipo_escola)
      where ue.id_unidade_escolar = $1`;

    return this.queryFindOne(sql, [id]);

  }

  buscarPorCodigoAndDiretoriaRegional(codigo, idDiretoriaRegional, _transaction) {

    const sql = `
      select 
        ue.id_unidade_escolar as id, ue.descricao, ue.codigo, ue.endereco, ue.numero, ue.bairro, ue.cep, ue.latitude, ue.longitude,
        ue.email, ue.telefone, ue.flag_ativo, ue.responsavel_legal_lista, te.descricao as tipo,
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola,
        json_build_object('id', dr.id_diretoria_regional, 'descricao', dr.descricao, 'email', dr.email) as diretoria_regional
      from unidade_escolar ue
      join diretoria_regional dr on dr.id_diretoria_regional = ue.id_diretoria_regional
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      where ue.codigo = trim($1) and ue.id_diretoria_regional = $2`;

    return this.queryFindOne(sql, [codigo, idDiretoriaRegional], _transaction);

  }

  buscarPorCodigo(codigo) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.*, ue.descricao, ue.codigo, ue.endereco, ue.numero, ue.bairro, ue.cep, ue.latitude, ue.longitude,
      ue.email, ue.telefone, ue.flag_ativo, ue.responsavel_legal_lista, te.descricao as tipo,
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola,
        json_build_object('id', dr.id_diretoria_regional, 'descricao', dr.descricao, 'email', dr.email) as diretoria_regional
      from unidade_escolar ue
      join diretoria_regional dr on dr.id_diretoria_regional = ue.id_diretoria_regional
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      where ue.codigo ilike ($1)`;

    return this.queryFindOne(sql, [codigo]);

  }

  buscarDetalhe(id) {

    const sql = `
      select 
        ue.id_unidade_escolar as id,
        ue.descricao,
        ue.codigo,
        ue.endereco,
        ue.numero,
        ue.bairro,
        ue.cep,
        ue.latitude,
        ue.longitude,
        ue.email,
        ue.telefone,
        ue.flag_ativo,
        ue.responsavel_legal_lista,

        -- prefere o status da relação contrato_unidade_escolar para um contrato ativo (hoje)
        coalesce(cue.id_status_unidade_escolar, ue.id_status_unidade_escolar) as id_status_unidade_escolar,
        coalesce(suc.descricao, sue.descricao) as status_descricao,
        cue.motivo_status as motivo_status,

        te.descricao as tipo,
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola,
        json_build_object('id', dr.id_diretoria_regional, 'descricao', dr.descricao, 'email', dr.email) as diretoria_regional

      from unidade_escolar ue
      join diretoria_regional dr 
        on dr.id_diretoria_regional = ue.id_diretoria_regional
      join tipo_escola te 
        on te.id_tipo_escola = ue.id_tipo_escola

      -- pega uma relação contrato_unidade_escolar ativa (se existir) para a UE (hoje)
      left join lateral (
        select *
        from contrato_unidade_escolar cue2
        where cue2.id_unidade_escolar = ue.id_unidade_escolar
          and now()::date between cue2.data_inicial and cue2.data_final
        order by cue2.data_inicial desc
        limit 1
      ) cue on true

      left join status_unidade_escolar suc
        on suc.id_status_unidade_escolar = cue.id_status_unidade_escolar

      left join status_unidade_escolar sue
        on sue.id_status_unidade_escolar = ue.id_status_unidade_escolar

      where ue.id_unidade_escolar = $1
      limit 1;
    `;

    return this.queryFindOne(sql, [id]);

  }


  combo() {

    const sql = `
      select ue.id_unidade_escolar as id, ue.descricao, ue.codigo, te.descricao as tipo
      from unidade_escolar ue
      join tipo_escola te using (id_tipo_escola)
      where ue.flag_ativo
      order by ue.descricao`;

    return this.queryFindAll(sql);

  }

  comboTodos() {

    const sql = `
      select ue.id_unidade_escolar as id, ue.descricao, ue.codigo, te.descricao as tipo
      from unidade_escolar ue
      join tipo_escola te using (id_tipo_escola)
      order by ue.descricao`;

    return this.queryFindAll(sql);

  }

  comboPorDRE(idDiretoriaRegional) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.descricao, ue.codigo, te.descricao as tipo
      from unidade_escolar ue
      join tipo_escola te using (id_tipo_escola)
      where ue.flag_ativo and ue.id_diretoria_regional = $1
      order by ue.descricao`;

    return this.queryFindAll(sql, [idDiretoriaRegional]);

  }

  comboPorContratos(idContratoList) {

    const sql = `
      with dados as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
        where id_contrato = any($1::int[])
      )
      select ue.id_unidade_escolar as id, ue.codigo, ue.descricao, te.descricao as tipo, 
        ue.endereco || ', ' || ue.numero || ', ' || ue.bairro as endereco,
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola
      from dados d
      join unidade_escolar ue using (id_unidade_escolar)
      join tipo_escola te USING(id_tipo_escola)
      where ue.flag_ativo
      order by ue.descricao`;

    return this.queryFindAll(sql, [idContratoList]);

  }

  comboTodosDiretoriaRegional(idDiretoriaRegional) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.descricao, ue.codigo, te.descricao as tipo
      from unidade_escolar ue
      join tipo_escola te using (id_tipo_escola)
      where ue.id_diretoria_regional = $1
      order by ue.descricao`;

    return this.queryFindAll(sql, [idDiretoriaRegional]);

  }

  comboDetalhado(idUsuarioPrestador) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.descricao, ue.codigo, ue.endereco, ue.numero, ue.bairro, ue.cep, ue.latitude, ue.longitude,
        ue.email, ue.telefone, ue.flag_ativo, ue.responsavel_legal_lista, te.descricao as tipo,
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola,
        json_build_object('id', dr.id_diretoria_regional, 'descricao', dr.descricao) as diretoria_regional
      from unidade_escolar ue
      join diretoria_regional dr on dr.id_diretoria_regional = ue.id_diretoria_regional
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      ${idUsuarioPrestador ? `
        join usuario_prestador_unidade_escolar upue 
          on upue.id_unidade_escolar = ue.id_unidade_escolar 
          and upue.id_usuario = ${idUsuarioPrestador}` : ``}
      where ue.flag_ativo
      order by ue.descricao`;

    return this.queryFindAll(sql);

  }

  carregarComboDetalhadoTodos(idUsuarioPrestador) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.descricao, ue.codigo, ue.endereco, ue.numero, ue.bairro, ue.cep, ue.latitude, ue.longitude,
        ue.email, ue.telefone, ue.flag_ativo, ue.responsavel_legal_lista, te.descricao as tipo, 
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola,
        json_build_object('id', dr.id_diretoria_regional, 'descricao', dr.descricao) as diretoria_regional
      from unidade_escolar ue
      join diretoria_regional dr on dr.id_diretoria_regional = ue.id_diretoria_regional
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      ${idUsuarioPrestador ? `
        join usuario_prestador_unidade_escolar upue 
          on upue.id_unidade_escolar = ue.id_unidade_escolar 
          and upue.id_usuario = ${idUsuarioPrestador}` : ``}
      order by ue.descricao`;

    return this.queryFindAll(sql);

  }

  comboPorPrestadorServicoAndUsuario(idUsuario, idPrestadorServico) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.codigo, ue.descricao, te.descricao as tipo, 
        ue.endereco || ', ' || ue.numero || ', ' || ue.bairro as endereco,
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola
      from unidade_escolar ue
      join contrato_unidade_escolar cue using (id_unidade_escolar)
      join contrato c using (id_contrato)
      join usuario_prestador_unidade_escolar upue on upue.id_unidade_escolar = ue.id_unidade_escolar and upue.id_usuario = $1
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      where ue.flag_ativo and c.id_prestador_servico = $2
      order by ue.descricao`;

    return this.queryFindAll(sql, [idUsuario, idPrestadorServico]);

  }

  comboTodosPorPrestadorServicoAndUsuario(idUsuario, idPrestadorServico) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.codigo, ue.descricao, te.descricao as tipo, 
        ue.endereco || ', ' || ue.numero || ', ' || ue.bairro as endereco,
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola
      from unidade_escolar ue
      join contrato_unidade_escolar cue using (id_unidade_escolar)
      join contrato c using (id_contrato)
      join usuario_prestador_unidade_escolar upue on upue.id_unidade_escolar = ue.id_unidade_escolar and upue.id_usuario = $1
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      where c.id_prestador_servico = $2
      order by ue.descricao`;

    return this.queryFindAll(sql, [idUsuario, idPrestadorServico]);

  }

  comboTodosPorPrestadorServico(idPrestadorServico) {

    const sql = `
      select ue.id_unidade_escolar as id, ue.codigo, ue.descricao, te.descricao as tipo, 
        ue.endereco || ', ' || ue.numero || ', ' || ue.bairro as endereco,
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola
      from unidade_escolar ue
      join contrato_unidade_escolar cue using (id_unidade_escolar)
      join contrato c using (id_contrato)
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      where c.id_prestador_servico = $1 
      order by ue.descricao`;

    return this.queryFindAll(sql, [idPrestadorServico]);

  }

  comboTodosPorContratos(idContratoList) {

    const sql = `
      with dados as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
        where id_contrato = any($1::int[])
      )
      select ue.id_unidade_escolar as id, ue.codigo, ue.descricao, te.descricao as tipo, 
        ue.endereco || ', ' || ue.numero || ', ' || ue.bairro as endereco,
        json_build_object('id', te.id_tipo_escola, 'descricao', te.descricao) as tipo_escola
      from dados d
      join unidade_escolar ue using (id_unidade_escolar)
      join tipo_escola te USING(id_tipo_escola)
      order by ue.descricao`;

    return this.queryFindAll(sql, [idContratoList]);

  }

  datatable(idTipoEscola, idUnidadeEscolar, idDiretoriaRegional, descricao, length, start) {

    const sql = `
      with unidades as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
      )
      select count(ue.*) over() as records_total, ue.id_unidade_escolar as id, ue.codigo, ue.descricao, ue.bairro, te.descricao as tipo, dre.descricao as dre
      from unidades u
      join unidade_escolar ue using (id_unidade_escolar)
      join tipo_escola te using (id_tipo_escola)
      join diretoria_regional dre on dre.id_diretoria_regional = ue.id_diretoria_regional
      where ue.flag_ativo and dre.flag_ativo 
        and case when $1::int is null then true else te.id_tipo_escola = $1::int end
        and case when $2::int is null then true else ue.id_unidade_escolar = $2::int end
        and case when $3::int is null then true else dre.id_diretoria_regional = $3::int end
        and case when $4::text is null then true else ue.descricao ilike ('%' || $4::text || '%') end
      order by ue.descricao
      limit $5 offset $6`;

    return this.queryFindAll(sql, [idTipoEscola, idUnidadeEscolar, idDiretoriaRegional, descricao, length, start]);

  }

  insert(descricao, codigo, endereco, numero, bairro, cep, latitude, longitude, telefone, email, idTipoEscola, idDiretoriaRegional, responsavelLegalLista, _transaction) {

    const sql = `
      insert into unidade_escolar (descricao, codigo, endereco, numero, bairro, cep, latitude, longitude, 
        telefone, email, id_tipo_escola, id_diretoria_regional, responsavel_legal_lista) 
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`;

    return this.query(sql, [descricao, codigo, endereco, numero, bairro, cep, latitude, longitude, telefone, email, idTipoEscola, idDiretoriaRegional, responsavelLegalLista], _transaction);

  }

  atualizar(id, descricao, codigo, endereco, numero, bairro, cep, latitude, longitude, telefone, email, idTipoEscola, idDiretoriaRegional, responsavelLegalLista, _transaction) {

    const sql = `
      update unidade_escolar
      set descricao = $1, codigo = $2, endereco = $3, numero= $4, bairro = $5, cep = $6, latitude = $7, longitude = $8, telefone = $9, email = $10,
        id_tipo_escola = $11, id_diretoria_regional = $12, responsavel_legal_lista = $13, flag_ativo = true 
      where id_unidade_escolar = $14`;

    return this.query(sql, [descricao, codigo, endereco, numero, bairro, cep, latitude, longitude, telefone, email, idTipoEscola, idDiretoriaRegional, responsavelLegalLista, id], _transaction);

  }

  remover(_transaction, id) {

    const sql = `
      update unidade_escolar 
      set flag_ativo = false 
      where id_unidade_escolar = $1`;

    return this.query(sql, [id], _transaction);

  }

  removerByIdDiretoriaRegional(_transaction, idDiretoriaRegional) {

    const sql = `
      update unidade_escolar set flag_ativo = false 
      where id_diretoria_regional = $1`;

    return this.query(sql, [idDiretoriaRegional], _transaction);

  }

  comboTipoEscola() {

    const sql = `
      select id_tipo_escola as id, descricao 
      from tipo_escola
      order by descricao`;

    return this.queryFindAll(sql);

  }

  buscarPrestadorServicoAtual(idUnidadeEscolar, data) {

    const sql = `
      with cue as (
        select * from contrato_unidade_escolar
        where id_unidade_escolar = $1 and $2::date between data_inicial and data_final
      )
      select ps.id_prestador_servico as id, ps.*
      from unidade_escolar ue
      join cue using (id_unidade_escolar)
      join contrato c using (id_contrato)
      join prestador_servico ps using (id_prestador_servico)`;

    return this.queryFindOne(sql, [idUnidadeEscolar, data]);

  }

  buscarContrato(idUnidadeEscolar, data) {

    const sql = `
      with cue as (
        select * from contrato_unidade_escolar
        where id_unidade_escolar = $1 and $2::date between data_inicial and data_final
      )
      select c.id_contrato, c.codigo, c.modelo, cue.data_inicial, cue.data_final
      from contrato c
      join cue using (id_contrato)`;

    return this.queryFindOne(sql, [idUnidadeEscolar, data]);

  }

  // to-do tarefa historico
  async buscarStatusAtual(_transaction, contratoId, unidadeIds = []) {
    if (!Array.isArray(unidadeIds) || unidadeIds.length === 0) return [];

    const unidadeIdsInt = unidadeIds
      .map(v => Number(v))
      .filter(Number.isInteger);

    if (unidadeIdsInt.length === 0) return [];

    const sql = `
    SELECT id_unidade_escolar, id_status_unidade_escolar
    FROM contrato_unidade_escolar
    WHERE id_contrato = $1
      AND id_unidade_escolar = ANY($2::int[])
  `;

    const rows = await this.queryFindAll(sql, [contratoId, unidadeIdsInt], _transaction);
    return rows || [];
  }

  async atualizarStatusNoContrato(_transaction, contratoId, unidadeId, idStatus, motivo) {
    const sql = `
      UPDATE contrato_unidade_escolar
      SET id_status_unidade_escolar = $3,
          motivo_status = $4
      WHERE id_contrato = $1
        AND id_unidade_escolar = $2
    `;
    return this.query(sql, [contratoId, unidadeId, idStatus, motivo], _transaction);
  }

  async inserirHistoricoStatus(_transaction, contratoId, unidadeId, idStatusAntigo, idStatusNovo, motivo, usuarioId) {
    const sql = `
      INSERT INTO contrato_unidade_status_historico
        (id_contrato, id_unidade_escolar, id_status_antigo, id_status_novo, motivo, id_usuario, data_hora)
      VALUES ($1, $2, $3, $4, $5, $6, now())
    `;
    return this.query(sql, [contratoId, unidadeId, idStatusAntigo, idStatusNovo, motivo, usuarioId], _transaction);
  }
}

module.exports = UnidadeEscolarDao;