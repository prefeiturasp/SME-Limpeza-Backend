const GenericDao = require('rfr')('core/generic-dao.js');

class OcorrenciaMensagemDao extends GenericDao {

  constructor() {
    super('ocorrencia_mensagem');
  }

  buscarPorOcorrencia(idOcorrencia) {

    const sql = `
      select om.id_ocorrencia_mensagem as id, om.data_hora, om.mensagem,
        json_build_object('nome', u.nome, 'origem', uo.codigo) as usuario
      from ocorrencia_mensagem om
      left join usuario u using (id_usuario)
      join usuario_cargo uc using (id_usuario_cargo)
      join usuario_origem uo using (id_usuario_origem)
      where om.id_ocorrencia = $1
      order by om.data_hora`;

    return this.queryFindAll(sql, [idOcorrencia]);

  }

  buscarUltimos(idUsuario, ehPrestadorServico, idPrestadorServico, idUnidadeEscolar, idContratoList) {

    const sql = `
      with unidades as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
        where case when $3::int[] is null then true else id_contrato = any($3::int[]) end
      )
      select om.id_ocorrencia_mensagem as id, om.id_ocorrencia, o.data as data_ocorrencia, om.data_hora, om.mensagem, u.nome as usuario
      from unidades un
      join ocorrencia o on o.id_unidade_escolar = un.id_unidade_escolar
      join ocorrencia_mensagem om on om.id_ocorrencia = o.id_ocorrencia
      join usuario u using (id_usuario)
      join unidade_escolar ue on ue.id_unidade_escolar = o.id_unidade_escolar
      ${ehPrestadorServico ? `
        join usuario_prestador_unidade_escolar upue 
          on upue.id_unidade_escolar = ue.id_unidade_escolar 
          and upue.id_usuario = ${idUsuario}` : ``}
      where
          case when $1::int is null then true else o.id_prestador_servico = $1::int end
          and case when $2::int is null then true else o.id_unidade_escolar = $2::int end
      order by om.data_hora desc
      limit 20`;

    return this.queryFindAll(sql, [idPrestadorServico, idUnidadeEscolar, idContratoList]);

  }

  datatable(idUsuario, ehPrestadorServico, idPrestadorServico, idUnidadeEscolar, idContratoList, length, start) {

    const sql = `
      with unidades as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
        where case when $3::int[] is null then true else id_contrato = any($3::int[]) end
      )
      select count(om.*) over() as records_total, om.id_ocorrencia_mensagem as id, om.id_ocorrencia, o.data as data_ocorrencia,
        om.data_hora, om.mensagem, u.nome as usuario
      from unidades un
      join ocorrencia o on o.id_unidade_escolar = un.id_unidade_escolar
      join ocorrencia_mensagem om on om.id_ocorrencia = o.id_ocorrencia
      join usuario u using (id_usuario)
      join unidade_escolar ue on ue.id_unidade_escolar = o.id_unidade_escolar
      ${ehPrestadorServico ? `
        join usuario_prestador_unidade_escolar upue 
          on upue.id_unidade_escolar = ue.id_unidade_escolar 
          and upue.id_usuario = ${idUsuario}` : ``}
      where
        case when $1::int is null then true else o.id_prestador_servico = $1::int end
        and case when $2::int is null then true else o.id_unidade_escolar = $2::int end
      order by o.id_ocorrencia desc
      limit $4 offset $5`

    return this.queryFindAll(sql, [idPrestadorServico, idUnidadeEscolar, idContratoList, length, start]);

  }

  inserir(idOcorrencia, idUsuario, mensagem, dataHora) {

    const sql = `
      insert into ocorrencia_mensagem (id_ocorrencia, id_usuario, mensagem, data_hora)
      values ($1, $2, $3, $4)`;

    return this.query(sql, [idOcorrencia, idUsuario, mensagem, dataHora]);

  }

}

module.exports = OcorrenciaMensagemDao;