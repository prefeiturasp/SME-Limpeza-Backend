const GenericDao = require('rfr')('core/generic-dao.js');

class PlanoTrabalhoUnidadeEscolarDao extends GenericDao {

  constructor() {
    super('plano_trabalho_unidade_escolar');
  }

  buscar(id) {

    const sql = `
      select ptue.*, aue.id_ambiente_geral, 
        json_build_object('descricao', ue.descricao, 'codigo', ue.codigo, 'tipo', te.descricao) as unidade_escolar
      from plano_trabalho_unidade_escolar ptue
      join ambiente_unidade_escolar aue using (id_ambiente_unidade_escolar)
      join ambiente_geral ag using (id_ambiente_geral)
      join unidade_escolar ue on ue.id_unidade_escolar = ptue.id_unidade_escolar
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      where ptue.id_plano_trabalho_unidade_escolar = $1`;

    return this.queryFindOne(sql, [id]);

  }

  datatable(idUsuario, ehPrestadorServico, idUnidadeEscolar, idPeriodicidade, idAmbienteUnidadeEscolar, idTipoAmbiente, length, start) {

    const sql = `
      select count(*) over() as records_total, ptue.id_plano_trabalho_unidade_escolar as id, ptue.flag_aprovado,
        to_jsonb(t) as turno, to_jsonb(p) as periodicidade, 
        ptue.descricao, aue.descricao as ambiente, ta.descricao as tipo_ambiente,
        json_build_object('descricao', ue.descricao, 'codigo', ue.codigo, 'tipo', te.descricao) as unidade_escolar
      from plano_trabalho_unidade_escolar ptue
      join ambiente_unidade_escolar aue using (id_ambiente_unidade_escolar)
      join ambiente_geral ag using (id_ambiente_geral)
      join tipo_ambiente ta using (id_tipo_ambiente)
      join turno t on t.id_turno = ptue.id_turno
      join periodicidade p on p.id_periodicidade = ptue.id_periodicidade
      join unidade_escolar ue on ue.id_unidade_escolar = ptue.id_unidade_escolar
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      ${ehPrestadorServico ? `
        join usuario_prestador_unidade_escolar upue 
          on upue.id_unidade_escolar = ue.id_unidade_escolar
          and upue.id_usuario = ${idUsuario}` : ``}
      where ptue.flag_ativo
        and case when $1::int is null then true else ptue.id_unidade_escolar = $1::int end
        and case when $2::int is null then true else ptue.id_periodicidade = $2::int end
        and case when $3::int is null then true else ptue.id_ambiente_unidade_escolar = $3::int end
        and case when $4::int is null then true else ag.id_tipo_ambiente = $4::int end
      order by aue.descricao limit $5 offset $6`;

    return this.queryFindAll(sql, [idUnidadeEscolar, idPeriodicidade, idAmbienteUnidadeEscolar, idTipoAmbiente, length, start]);

  }

  buscarTodos(idUsuario, ehPrestadorServico, idUnidadeEscolar, idPeriodicidade, idAmbienteUnidadeEscolar, idTipoAmbiente) {

    const sql = `
      select ptue.id_plano_trabalho_unidade_escolar as id, ptue.flag_aprovado,
        to_jsonb(t) as turno, to_jsonb(p) as periodicidade, ptue.dia_semana, ptue.flag_final_semana,
        ptue.descricao, aue.descricao as ambiente, ta.descricao as tipo_ambiente,
        json_build_object('descricao', ue.descricao, 'endereco', ue.endereco || ', ' || ue.numero || ' - ' || ue.bairro) as unidade_escolar
      from plano_trabalho_unidade_escolar ptue
      join ambiente_unidade_escolar aue using (id_ambiente_unidade_escolar)
      join ambiente_geral ag using (id_ambiente_geral)
      join tipo_ambiente ta using (id_tipo_ambiente)
      join turno t on t.id_turno = ptue.id_turno
      join periodicidade p on p.id_periodicidade = ptue.id_periodicidade
      join unidade_escolar ue on ue.id_unidade_escolar = ptue.id_unidade_escolar
      ${ehPrestadorServico ? `
        join usuario_prestador_unidade_escolar upue 
          on upue.id_unidade_escolar = ue.id_unidade_escolar
          and upue.id_usuario = ${idUsuario}` : ``}
      where ptue.flag_ativo
        and case when $1::int is null then true else ptue.id_unidade_escolar = $1::int end
        and case when $2::int is null then true else ptue.id_periodicidade = $2::int end
        and case when $3::int is null then true else ptue.id_ambiente_unidade_escolar = $3::int end
        and case when $4::int is null then true else ag.id_tipo_ambiente = $4::int end
      order by aue.descricao`;

    return this.queryFindAll(sql, [idUnidadeEscolar, idPeriodicidade, idAmbienteUnidadeEscolar, idTipoAmbiente]);

  }

  insert(_transaction, idUnidadeEscolar, idAmbienteUnidadeEscolar, idPeriodicidade, idTurno, descricao, diaSemana, dataInicial, flagFinalSemana, flagAprovado) {

    const sql = `
      insert into plano_trabalho_unidade_escolar (id_unidade_escolar, id_ambiente_unidade_escolar, id_periodicidade, id_turno, descricao, dia_semana, data_inicial, flag_final_semana, flag_aprovado) 
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

    return this.query(sql, [idUnidadeEscolar, idAmbienteUnidadeEscolar, idPeriodicidade, idTurno, descricao, diaSemana, dataInicial, flagFinalSemana, flagAprovado], _transaction);

  }

  atualizar(id, idAmbienteUnidadeEscolar, idPeriodicidade, idTurno, descricao, diaSemana, dataInicial, flagFinalSemana, flagAprovado) {

    const sql = `
      update plano_trabalho_unidade_escolar 
      set descricao = $1, id_periodicidade = $2, id_turno = $3, id_ambiente_unidade_escolar = $4, dia_semana = $5, data_inicial = $6, flag_final_semana = $7, flag_aprovado = $8
      where id_plano_trabalho_unidade_escolar = $9`;

    return this.query(sql, [descricao, idPeriodicidade, idTurno, idAmbienteUnidadeEscolar, diaSemana, dataInicial, flagFinalSemana, flagAprovado, id]);

  }

  remover(id) {

    const sql = `
      update plano_trabalho_unidade_escolar 
      set flag_ativo = false 
      where id_plano_trabalho_unidade_escolar = $1`;

    return this.query(sql, [id]);

  }

  aprovar(id) {

    const sql = `
      update plano_trabalho_unidade_escolar 
      set flag_aprovado = true
      where id_plano_trabalho_unidade_escolar = $1`;

    return this.query(sql, [id]);

  }

}

module.exports = PlanoTrabalhoUnidadeEscolarDao;