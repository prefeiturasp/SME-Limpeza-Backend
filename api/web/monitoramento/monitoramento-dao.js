const GenericDao = require('rfr')('core/generic-dao.js');

class MonitoramentoDao extends GenericDao {

  constructor() {
    super('monitoramento');
  }

  buscar(id) {

    const sql = `
      select m.id_monitoramento, case when ptue is null then m.atividades else ptue.descricao end as atividades, 
        m.data, m.flag_realizado, m.data_hora_inicio, m.latitude_inicio, m.longitude_inicio,
        m.data_hora_termino, m.latitude_termino, m.longitude_termino,
        m.id_ocorrencia, to_jsonb(t) as turno, to_jsonb(p) as periodicidade,
        json_build_object('descricao', aue.descricao, 'tipo', ta.descricao, 'area', aue.area_ambiente) as ambiente,
        json_build_object('id_unidade_escolar', ue.id_unidade_escolar, 'descricao', ue.descricao, 'endereco', ue.endereco || ', ' || ue.numero || ' - ' || ue.bairro, 'latitude', ue.latitude, 'longitude', ue.longitude, 'tipo', te.descricao) as unidade_escolar,
        json_build_object('id_prestador_servico', ps.id_prestador_servico, 'razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
      from monitoramento m
      join ambiente_unidade_escolar aue using (id_ambiente_unidade_escolar)
      join ambiente_geral ag using (id_ambiente_geral)
      join tipo_ambiente ta using (id_tipo_ambiente)
      join unidade_escolar ue on ue.id_unidade_escolar = m.id_unidade_escolar
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      join prestador_servico ps on ps.id_prestador_servico = m.id_prestador_servico
      join turno t on t.id_turno = m.id_turno
      join periodicidade p on p.id_periodicidade = m.id_periodicidade
      left join plano_trabalho_unidade_escolar ptue on ptue.id_plano_trabalho_unidade_escolar = m.id_plano_trabalho_unidade_escolar
      where m.id_monitoramento = $1`;

    return this.queryFindOne(sql, [id]);

  }

  datatable(
    idUsuario,
    ehPrestadorServico,
    idPrestadorServico,
    idUnidadeEscolar,
    datasList,
    idAmbienteUnidadeEscolar,
    idContratoList,
    idDiretoriaRegional,
    length,
    start
  ) {
    const sql = `
    with unidades as (
      select distinct id_unidade_escolar
      from contrato_unidade_escolar
      where ($5::int[] is null or id_contrato = any($5::int[]))
    ),
    monitoramentos1 as (
      select m.*
      from monitoramento m
      where m.flag_ativo
        and ($1::int is null or m.id_prestador_servico = $1::int)
        and ($2::int is null or m.id_unidade_escolar = $2::int)
        and ($3::date[] is null or m.data = any($3::date[]))
        and ($4::int is null or m.id_ambiente_unidade_escolar = $4::int)
    ),
    monitoramentos2 as (
      select m.*
      from unidades u
      join monitoramentos1 m on u.id_unidade_escolar = m.id_unidade_escolar
    )
    select count(m.*) over() as records_total, m.id_monitoramento as id, m.data, m.flag_ativo, 
      to_jsonb(t) as turno, 
      to_jsonb(p) as periodicidade,
      m.flag_realizado, 
      case when m.id_ocorrencia is null then null else true end as flag_possui_ocorrencia,
      json_build_object('id', id_ambiente_unidade_escolar, 'descricao', aue.descricao, 'tipo', ta.descricao, 'area', aue.area_ambiente) as ambiente,
      json_build_object('descricao', ue.descricao, 'codigo', ue.codigo, 'endereco', ue.endereco || ', ' || ue.numero || ' - ' || ue.bairro, 'latitude', ue.latitude, 'longitude', ue.longitude, 'tipo', te.descricao) as unidade_escolar,
      json_build_object('razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
    from monitoramentos2 m
    join ambiente_unidade_escolar aue using (id_ambiente_unidade_escolar)
    join ambiente_geral ag using (id_ambiente_geral)
    join tipo_ambiente ta using (id_tipo_ambiente)
    join unidade_escolar ue on ue.id_unidade_escolar = m.id_unidade_escolar
    join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
    join prestador_servico ps on ps.id_prestador_servico = m.id_prestador_servico
    join turno t on t.id_turno = m.id_turno
    join periodicidade p on p.id_periodicidade = m.id_periodicidade
    ${ehPrestadorServico ? `
      join usuario_prestador_unidade_escolar upue 
        on upue.id_unidade_escolar = ue.id_unidade_escolar 
        and upue.id_usuario = ${idUsuario}` : ``}
    where ($6::int is null or ue.id_diretoria_regional = $6::int)
    order by m.data desc, aue.descricao, p.descricao, t.descricao
    limit $7 offset $8
  `;

    return this.queryFindAll(sql, [
      idPrestadorServico,
      idUnidadeEscolar,
      datasList,
      idAmbienteUnidadeEscolar,
      idContratoList,
      idDiretoriaRegional,
      length,
      start
    ]);
  }

  datatableDatasAgendamentoManual(idUnidadeEscolar, length, start) {

    const sql = `
      with dados as (
        select m.data, count(m) as quantidade
        from monitoramento m
        where m.flag_ativo and m.id_unidade_escolar = $1 and m.id_plano_trabalho_unidade_escolar is null
        group by m.data
        order by m.data desc
      )
      select count(d.*) over() as records_total, d.data, d.quantidade
      from dados d
      limit $2 offset $3`;

    return this.queryFindAll(sql, [idUnidadeEscolar, length, start]);

  }

  inserir(idPrestadorServico, idUnidadeEscolar, idAmbienteUnidadeEscolar, idPeriodicidade, idTurno, descricao, data) {

    const sql = `
      insert into monitoramento(id_prestador_servico, id_unidade_escolar, id_ambiente_unidade_escolar, id_periodicidade, id_turno, atividades, data) 
      values($1, $2, $3, $4, $5, $6, $7)`;

    return this.insertWithReturn(sql, [idPrestadorServico, idUnidadeEscolar, idAmbienteUnidadeEscolar, idPeriodicidade, idTurno, descricao, data], 'id_monitoramento');

  }

  atualizarData(id, novaData) {

    const sql = `
      update monitoramento set data = $2
      where id_monitoramento = $1 and flag_ativo and not flag_realizado`;

    return this.query(sql, [id, novaData]);

  }

  setarOcorrencia(_transaction, id, idOcorrencia) {

    const sql = `
      update monitoramento set id_ocorrencia = $2
      where id_monitoramento = $1`;

    return this.query(sql, [id, idOcorrencia], _transaction);

  }

  remover(id, idUsuario) {

    const sql = `
      update monitoramento set flag_ativo = false, id_usuario_remocao = $2, data_hora_remocao = $3
      where id_monitoramento = $1 and flag_ativo and not flag_realizado`;

    return this.query(sql, [id, idUsuario, new Date()]);

  }

  buscaFeriadoUEPorData(data, idUnidadeEscolar) {
    const sql = `
      SELECT id_feriado, data, descricao
      FROM feriado
      WHERE data = $1 AND id_unidade_escolar = $2
      LIMIT 1;`;
    return this.queryFindOne(sql, [data, idUnidadeEscolar]);
  }

  buscaContratoIdUeData(idUnidadeEscolar, data) {

    const sql = `
      with cue as (
        select * from contrato_unidade_escolar
        where id_unidade_escolar = $1 and $2::date between data_inicial and data_final
      )
      select c.id_contrato, c.limite_dias_excepcionais
      from contrato c
      join cue using (id_contrato)`;

    return this.queryFindOne(sql, [idUnidadeEscolar, data]);

  }

  buscaDiasExcepcionais(idContrato, idUnidadeEscolar, data) {
    const sql = `
      SELECT culde.id_contrato_unidade_escolar_limite_dias_excepcionais as id, culde.quantidade_dias_utilizados, c.limite_dias_excepcionais as dias_excepcionais
      FROM contrato_unidade_escolar_limite_dias_excepcionais culde
      JOIN contrato c on (c.id_contrato = culde.id_contrato)
      WHERE culde.id_contrato = $1 
      AND culde.id_unidade_escolar = $2 
      AND (DATE_TRUNC('month', CAST($3 AS DATE)) + INTERVAL '1 month' - INTERVAL '1 day')::DATE = culde.validade
      AND culde.status = true
      LIMIT 1`;
    return this.queryFindOne(sql, [idContrato, idUnidadeEscolar, data]);
  }

  inserirDiasExcepcionais(idContrato, idUnidadeEscolar, quantidadeUtilizada, validade) {
    const sql = `INSERT INTO contrato_unidade_escolar_limite_dias_excepcionais (id_contrato, id_unidade_escolar, quantidade_dias_utilizados, validade)
      VALUES ($1, $2, $3, $4)`;
    return this.query(sql, [idContrato, idUnidadeEscolar, quantidadeUtilizada, validade]);
  }

  atualizaDiasExcepcionais(idContratoUeDiaExcepcional, quantidadeUtilizada) {
    const sql = `UPDATE contrato_unidade_escolar_limite_dias_excepcionais
      SET quantidade_dias_utilizados = $2
      WHERE id_contrato_unidade_escolar_limite_dias_excepcionais = $1`;

      return this.query(sql, [idContratoUeDiaExcepcional, quantidadeUtilizada]);
  }

  desabilitaDiasExcepcionais(idContratoUeDiaExcepcional) {
    const sql = `UPDATE contrato_unidade_escolar_limite_dias_excepcionais
      SET status = false
      WHERE id_contrato_unidade_escolar_limite_dias_excepcionais = $1`;  
      return this.query(sql, [idContratoUeDiaExcepcional]);
  }

  comparaDataLimiteExcepcional(idContrato, idUnidadeEscolar, utimoDiaMes) {
 
    const sql = `
      SELECT id_contrato_unidade_escolar_limite_dias_excepcionais as id, validade, status
      FROM contrato_unidade_escolar_limite_dias_excepcionais
      WHERE id_contrato = $1 AND id_unidade_escolar = $2 AND validade = $3`;
      return this.queryFindOne(sql, [idContrato, idUnidadeEscolar, utimoDiaMes]);
  }

  deleta(idMonitoramento) {
    const sql = `DELETE FROM monitoramento WHERE id_monitoramento = $1`;
    return this.query(sql, [idMonitoramento]);
  } 

}

module.exports = MonitoramentoDao;