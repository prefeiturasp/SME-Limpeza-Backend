const GenericDao = require('rfr')('core/generic-dao.js');

class MonitoramentoDao extends GenericDao {

  constructor() {
    super('monitoramento');
  }

  buscarTurnos(idUnidadeEscolar, idPrestadorServico) {

    const sql = `
      with monitoramentos as (
        select distinct(id_turno), count(*) as total
        from monitoramento
        where flag_ativo and not flag_realizado and id_unidade_escolar = $1 
          and id_prestador_servico = $2 and data = $3
        group by 1
      )
      select t.id_turno, t.codigo, t.descricao, m.total
      from monitoramentos m
      join turno t using (id_turno)
      order by t.ordem`;

    return this.queryFindAll(sql, [idUnidadeEscolar, idPrestadorServico, new Date()]);

  }

  buscarAmbienteGeralTurno(idUnidadeEscolar, idPrestadorServico, idTurno) {

    const sql = `
      with monitoramentos as (
        select * from monitoramento
        where flag_ativo and not flag_realizado and id_unidade_escolar = $1 
          and id_prestador_servico = $2 and data = $3 and id_turno = $4
      )
      select distinct(ag.id_ambiente_geral), ag.descricao, ta.descricao as tipo, count(m) as total
      from monitoramentos m
      join ambiente_unidade_escolar aue using (id_ambiente_unidade_escolar)
      join ambiente_geral ag using (id_ambiente_geral)
      join tipo_ambiente ta using (id_tipo_ambiente)
      group by 1, 2, 3 order by 3, 2`;

    return this.queryFindAll(sql, [idUnidadeEscolar, idPrestadorServico, new Date(), idTurno]);

  }

  buscarMonitoramentos(idUnidadeEscolar, idPrestadorServico, idTurno, idAmbienteGeral) {

    const sql = `
      with monitoramentos as (
        select * from monitoramento
        where flag_ativo and not flag_realizado and id_unidade_escolar = $1 
          and id_prestador_servico = $2 and data = $3 and id_turno = $4
      )
      select m.id_monitoramento as id, case when ptue IS NULL THEN m.atividades ELSE ptue.descricao end as atividades, 
        m.data, m.flag_realizado, m.data_hora_inicio, m.latitude_inicio, m.longitude_inicio,
        m.data_hora_termino, m.latitude_termino, m.longitude_termino,
        json_build_object('descricao', aue.descricao, 'tipo', ta.descricao, 'area', aue.area_ambiente, 'hash', aue.hash) as ambiente,
        to_jsonb(t) as turno, to_jsonb(p) as periodicidade 
      from monitoramentos m
      join ambiente_unidade_escolar aue using (id_ambiente_unidade_escolar)
      join ambiente_geral ag using (id_ambiente_geral)
      join tipo_ambiente ta using (id_tipo_ambiente)
      join turno t on t.id_turno = m.id_turno
      join periodicidade p on p.id_periodicidade = m.id_periodicidade
      left join plano_trabalho_unidade_escolar ptue on ptue.id_plano_trabalho_unidade_escolar = m.id_plano_trabalho_unidade_escolar
      where aue.id_ambiente_geral = $5
      order by aue.descricao`;

    return this.queryFindAll(sql, [idUnidadeEscolar, idPrestadorServico, new Date(), idTurno, idAmbienteGeral]);

  }

  buscarTodos(idUnidadeEscolar, idPrestadorServico) {

    const sql = `
      select m.id_monitoramento as id, case when ptue IS NULL THEN m.atividades ELSE ptue.descricao end as atividades, 
        m.data, m.flag_realizado, m.data_hora_inicio, m.latitude_inicio, m.longitude_inicio,
        m.data_hora_termino, m.latitude_termino, m.longitude_termino,
        json_build_object('descricao', aue.descricao, 'tipo', ta.descricao, 'area', aue.area_ambiente, 'hash', aue.hash) as ambiente,
        to_jsonb(t) as turno, to_jsonb(p) as periodicidade 
      from monitoramento m
      join ambiente_unidade_escolar aue using (id_ambiente_unidade_escolar)
      join ambiente_geral ag using (id_ambiente_geral)
      join tipo_ambiente ta using (id_tipo_ambiente)
      join turno t on t.id_turno = m.id_turno
      join periodicidade p on p.id_periodicidade = m.id_periodicidade
      left join plano_trabalho_unidade_escolar ptue on ptue.id_plano_trabalho_unidade_escolar = m.id_plano_trabalho_unidade_escolar
      where m.flag_ativo and not m.flag_realizado and m.id_unidade_escolar = $1 and m.id_prestador_servico = $2 and m.data = $3`;

    return this.queryFindAll(sql, [idUnidadeEscolar, idPrestadorServico, new Date()]);

  }

  atualizar(id, flagRealizado, dataHoraInicio, latitudeInicio, longitudeInicio, dataHoraTermino, latitudeTermino, longitudeTermino, idUnidadeEscolar, idPrestadorServico, _transaction) {

    const sql = `
      update monitoramento set flag_realizado = $1, data_hora_inicio = $2, latitude_inicio = $3, longitude_inicio = $4, 
        data_hora_termino = $5, latitude_termino = $6, longitude_termino = $7 
      where id_monitoramento = $8 and id_unidade_escolar = $9 and id_prestador_servico = $10`;

    return this.query(sql, [flagRealizado, dataHoraInicio, latitudeInicio, longitudeInicio, dataHoraTermino, latitudeTermino, longitudeTermino, id, idUnidadeEscolar, idPrestadorServico], _transaction);

  }

}

module.exports = MonitoramentoDao;