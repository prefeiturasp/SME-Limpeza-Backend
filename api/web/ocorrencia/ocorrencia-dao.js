const GenericDao = require('rfr')('core/generic-dao.js');

class OcorrenciaDao extends GenericDao {

  constructor() {
    super('ocorrencia');
  }

  buscar(id) {

    const sql = `
      with arquivos as (
        select id_ocorrencia, array_agg(json_build_object(
          'caminho', caminho,
          'filename', filename,
          'filesize', filesize
        )) as arquivos
        from ocorrencia_arquivo oa
        where id_ocorrencia = $1
        group by 1
      ),
      cargos as (
        select id_ocorrencia, array_agg(json_build_object(
          'descricao', c.descricao,
          'quantidade_contratada', oe.quantidade_contratada,
          'quantidade_presente', oe.quantidade_presente,
          'quantidade_ausente', oe.quantidade_ausente
        ) order by c.descricao) as cargos
        from ocorrencia_equipe oe
        join cargo c using (id_cargo)
        where id_ocorrencia = $1
        group by 1
      )
      select o.id_ocorrencia as id, o.data, ot.descricao as tipo, o.data_hora_cadastro, o.id_monitoramento, o.flag_gerar_desconto, 
        to_json(ov) as variavel, o.acao_corretiva, o.observacao, o.data_hora_final is not null as flag_encerrado, o.data_hora_final, o.flag_encerramento_automatico, o.observacao_final, 
        exists (select 1 from ocorrencia_retroativa ocr where ocr.id_ocorrencia = o.id_ocorrencia) as flag_ocorrencia_retroativa,
        json_build_object('id', ue.id_unidade_escolar, 'descricao', ue.descricao, 'codigo', ue.codigo, 'id_diretoria_regional', ue.id_diretoria_regional, 'endereco', ue.endereco || ', ' || ue.numero || ' - ' || ue.bairro, 'latitude', ue.latitude, 'longitude', ue.longitude, 'tipo', te.descricao) as unidade_escolar,
        json_build_object('id', ps.id_prestador_servico, 'razao_social', ps.razao_social, 'cnpj', ps.cnpj, 'email', ps.email) as prestador_servico,
        coalesce(to_json(oa.arquivos), '[]') as arquivos,
        coalesce(to_json(c.cargos), '[]') as equipe_list,
        o.data_hora_remocao, u.nome as nome_usuario_remocao
      from ocorrencia o 
      join ocorrencia_variavel ov using (id_ocorrencia_variavel)
      join ocorrencia_tipo ot using (id_ocorrencia_tipo)
      join prestador_servico ps using (id_prestador_servico)
      join unidade_escolar ue using (id_unidade_escolar)
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      left join arquivos oa on oa.id_ocorrencia = o.id_ocorrencia
      left join cargos c on c.id_ocorrencia = o.id_ocorrencia
      left join usuario u on u.id_usuario = o.id_usuario_remocao
      where o.id_ocorrencia = $1`;

    return this.queryFindOne(sql, [id]);

  }

  reincidenciaPorPrestador(dataInicial, dataFinal) {

    const sql = `
      with ocorrencias as (
        select id_prestador_servico, id_unidade_escolar, id_ocorrencia_variavel, count(*) as total
        from ocorrencia 
        where data::date between $2::date and $1::date and data_hora_remocao is null
        group by 1, 2, 3
        having count(*) > 1
        order by 4
      )
      select ov.descricao as ocorrencia, ot.descricao as tipo, o.total,
        json_build_object('descricao', ue.descricao, 'endereco', ue.endereco || ', ' || ue.numero || ' - ' || ue.bairro, 'latitude', ue.latitude, 'longitude', ue.longitude, 'tipo', te.descricao) as unidade_escolar,
        json_build_object('razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
      from ocorrencias o
      join prestador_servico ps on ps.id_prestador_servico = o.id_prestador_servico 
      join unidade_escolar ue on ue.id_unidade_escolar = o.id_unidade_escolar
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      join ocorrencia_variavel ov on ov.id_ocorrencia_variavel = o.id_ocorrencia_variavel 
      join ocorrencia_tipo ot on ot.id_ocorrencia_tipo = ov.id_ocorrencia_tipo
      order by o.total desc, ue.descricao`;

    return this.queryFindAll(sql, [dataInicial, dataFinal]);

  }

  buscarUltimos(idUsuario, ehPrestadorServico, idPrestadorServico, idUnidadeEscolar, idContratoList) {

    const sql = `
      with unidades as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
        where case when $3::int[] is null then true else id_contrato = any($3::int[]) end
      )
      select o.id_ocorrencia as id, o.data, o.flag_gerar_desconto, o.data_hora_cadastro, 
        o.data_hora_final is not null as flag_encerrado, ot.descricao as tipo,
        json_build_object('descricao', ue.descricao, 'endereco', ue.endereco || ', ' || ue.numero || ' - ' || ue.bairro, 'latitude', ue.latitude, 'longitude', ue.longitude, 'tipo', te.descricao) as unidade_escolar,
        json_build_object('razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
      from unidades u
      join ocorrencia o on o.id_unidade_escolar = u.id_unidade_escolar
      join ocorrencia_variavel ov using (id_ocorrencia_variavel)
      join ocorrencia_tipo ot on ot.id_ocorrencia_tipo = ov.id_ocorrencia_tipo
      join prestador_servico ps on ps.id_prestador_servico = o.id_prestador_servico
      join unidade_escolar ue on ue.id_unidade_escolar = o.id_unidade_escolar
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      ${ehPrestadorServico ? `
        join usuario_prestador_unidade_escolar upue 
          on upue.id_unidade_escolar = ue.id_unidade_escolar 
          and upue.id_usuario = ${idUsuario}` : ``} 
      where
        o.data_hora_remocao is null
        and case when $1::int is null then true else o.id_prestador_servico = $1::int end
        and case when $2::int is null then true else o.id_unidade_escolar = $2::int end
      order by o.data_hora_cadastro desc
      limit 20`;

    return this.queryFindAll(sql, [idPrestadorServico, idUnidadeEscolar, idContratoList]);

  }

  datatable(idUsuario, ehPrestadorServico, idPrestadorServico, idUnidadeEscolarList, idOcorrenciaTipo, dataInicial, dataFinal, flagEncerrado, flagSomenteAtivos, idContratoList, idDiretoriaRegional, ehRespondido, length, start) {

    const sql = `
      with unidades as (
        -- apenas filtra as unidades elegíveis pelo conjunto de contratos ($8),
        -- sem carregar id_contrato para não multiplicar linhas
        select distinct cue.id_unidade_escolar
        from contrato_unidade_escolar cue
        where ($8::int[] is null or cue.id_contrato = any($8::int[]))
      )
      select
        count(o.*) over() as records_total,
        o.id_ocorrencia as id,
        o.data,
        o.flag_gerar_desconto,
        o.data_hora_cadastro,
        o.flag_encerramento_automatico,
        o.observacao_final,
        (o.data_hora_final is not null) as flag_encerrado,
        ot.descricao as tipo,

        json_build_object(
          'descricao', ue.descricao,
          'codigo',    ue.codigo,
          'tipo',      te.descricao
        ) as unidade_escolar,

        json_build_object(
          'razao_social', ps.razao_social,
          'cnpj',         ps.cnpj
        ) as prestador_servico,

        -- contrato vigente único na data da ocorrência
        json_build_object(
          'contratoId',        csel.id_contrato,
          'contratoCodigo',    csel.codigo,
          'contratoDescricao', csel.descricao
        ) as contrato,

        /* Respondida = existe mensagem cuja autoria tenha id_usuario_origem = 4 (prestador de servico) */
        exists (
          select 1
          from ocorrencia_mensagem om
          join usuario u_msg
            on u_msg.id_usuario = om.id_usuario
          join usuario_cargo uc
            on uc.id_usuario_cargo = u_msg.id_usuario_cargo
          where om.id_ocorrencia = o.id_ocorrencia
            and uc.id_usuario_origem = 4
        ) as ocorrencia_respondida

      from unidades u
      join ocorrencia o using (id_unidade_escolar)
      join ocorrencia_variavel ov using (id_ocorrencia_variavel)
      join ocorrencia_tipo ot using (id_ocorrencia_tipo)
      join prestador_servico ps using (id_prestador_servico)
      join unidade_escolar ue on ue.id_unidade_escolar = o.id_unidade_escolar
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola

      -- se for prestador de serviço, restringe às unidades do usuário
      ${ehPrestadorServico ? `
      join usuario_prestador_unidade_escolar upue 
        on upue.id_unidade_escolar = ue.id_unidade_escolar 
        and upue.id_usuario = ${idUsuario}
      ` : ``}

      -- Seleciona 1 contrato vigente na data da ocorrência para a unidade
      left join lateral (
        select distinct on (cue.id_unidade_escolar)
              c.id_contrato, c.codigo, c.descricao
        from contrato_unidade_escolar cue
        join contrato c using (id_contrato)
        where cue.id_unidade_escolar = o.id_unidade_escolar
          and ($8::int[] is null or c.id_contrato = any($8::int[]))
          -- vigência do vínculo unidade-contrato
          and o.data::date >= coalesce(cue.data_inicial::date, o.data::date)
          and o.data::date <= coalesce(cue.data_final::date, '9999-12-31'::date)
          -- vigência do contrato
          and (c.data_inicial is null or o.data::date >= c.data_inicial::date)
          and (c.data_final   is null or o.data::date <= c.data_final::date)
        -- critério de desempate: vínculo que termina por último, depois contrato que termina por último
        order by cue.id_unidade_escolar, cue.data_final desc nulls last, c.data_final desc nulls last
      ) csel on true

      where
        -- $1: idPrestadorServico
        case when $1::int is null then true else o.id_prestador_servico = $1::int end

        -- $2: idUnidadeEscolarList (int[])
        and case when $2::int[] is null then true else o.id_unidade_escolar = any($2::int[]) end

        -- $3: idOcorrenciaTipo
        and case when $3::int is null then true else ov.id_ocorrencia_tipo = $3::int end

        -- $4..$5: intervalo de datas
        and o.data::date between $4::date and $5::date

        -- $6: flagEncerrado
        and case when $6::bool is null then true else 
              case when $6::bool then o.data_hora_final is not null
                  else o.data_hora_final is null end
            end

        -- $7: flagSomenteAtivos
        and case when $7::bool then o.data_hora_remocao is null else o.data_hora_remocao is not null end

        -- $9: idDiretoriaRegional
        and case when $9::int is null then true else ue.id_diretoria_regional = $9::int end

        -- $10: ehRespondido (bool)
        and case
              when $10::bool is null then true
              when $10::bool
                then exists (
                      select 1
                      from ocorrencia_mensagem om
                      join usuario u_msg
                        on u_msg.id_usuario = om.id_usuario
                      join usuario_cargo uc
                        on uc.id_usuario_cargo = u_msg.id_usuario_cargo
                      where om.id_ocorrencia = o.id_ocorrencia
                        and uc.id_usuario_origem = 4
                    )
              else not exists (
                    select 1
                    from ocorrencia_mensagem om
                    join usuario u_msg
                      on u_msg.id_usuario = om.id_usuario
                    join usuario_cargo uc
                      on uc.id_usuario_cargo = u_msg.id_usuario_cargo
                    where om.id_ocorrencia = o.id_ocorrencia
                      and uc.id_usuario_origem = 4
                  )
            end

        -- $8: idContratoList (int[]) - Exige vínculo vigente com contrato da lista
        and (
          $8::int[] is null
          or exists (
              select 1
              from contrato_unidade_escolar cue2
              join contrato c2 using (id_contrato)
              where cue2.id_unidade_escolar = o.id_unidade_escolar
                and c2.id_contrato = any($8::int[])
                -- vigência do vínculo na data da ocorrência
                and o.data::date >= coalesce(cue2.data_inicial::date, o.data::date)
                and o.data::date <= coalesce(cue2.data_final::date, '9999-12-31'::date)
                -- vigência do contrato
                and (c2.data_inicial is null or o.data::date >= c2.data_inicial::date)
                and (c2.data_final   is null or o.data::date <= c2.data_final::date)
            )
        )

      order by o.id_ocorrencia desc, ov.descricao, ue.descricao, ps.razao_social
      limit $11 offset $12;
  `;

    return this.queryFindAll(sql, [
      idPrestadorServico, idUnidadeEscolarList, idOcorrenciaTipo,
      dataInicial, dataFinal, flagEncerrado, flagSomenteAtivos,
      idContratoList, idDiretoriaRegional, ehRespondido, length, start
    ]);
  }

  exportar(idUsuario, ehPrestadorServico, idPrestadorServico, idUnidadeEscolar, idOcorrenciaTipo, dataInicial, dataFinal, flagEncerrado, flagSomenteAtivos, idContratoList, idDiretoriaRegional) {
    
    const sql = `
      with unidades as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
        where case when $8::int[] is null then true else id_contrato = any($8::int[]) end
      )
      select o.id_ocorrencia as id, o.data as data_hora_ocorrencia, o.data_hora_cadastro,
        ue.codigo as ue_codigo, ue.descricao as ue_nome,
        ot.descricao as variavel_gerencial_principal, ov.descricao as variavel_gerencial_secundaria, o.observacao, 
      case when o.acao_corretiva is not null then o.acao_corretiva else ' - ' end as acao_corretiva,
      case when aue.descricao is not null then aue.descricao else ' - ' end as ambiente,
      case 
          when o.flag_encerramento_automatico is true then 'Automaticamente'
          when o.flag_encerrado is true then 'Sim'
          else 'Não'
      end as encerrado,
      case when o.flag_encerrado is true and o.flag_gerar_desconto is false then 'Sim' else 'Não' end as atendido
      from unidades u
      join ocorrencia o using (id_unidade_escolar)
      left join monitoramento using (id_monitoramento)
      left join ambiente_unidade_escolar aue using (id_ambiente_unidade_escolar)
      join ocorrencia_variavel ov using (id_ocorrencia_variavel)
      join ocorrencia_tipo ot using (id_ocorrencia_tipo)
      join prestador_servico ps on ps.id_prestador_servico = o.id_prestador_servico
      join unidade_escolar ue on ue.id_unidade_escolar = o.id_unidade_escolar
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      ${ehPrestadorServico ? `
        join usuario_prestador_unidade_escolar upue 
          on upue.id_unidade_escolar = ue.id_unidade_escolar 
          and upue.id_usuario = ${idUsuario}` : ``}
      where
        case when $1::int is null then true else o.id_prestador_servico = $1::int end
        and case when $2::int is null then true else o.id_unidade_escolar = $2::int end
        and case when $3::int is null then true else ov.id_ocorrencia_tipo = $3::int end
        and o.data::date between $4::date and $5::date
        and case when $6::bool is null then true else 
          case when $6::bool then o.data_hora_final is not null
          else o.data_hora_final is null end end
        and case when $7::bool then o.data_hora_remocao is null else o.data_hora_remocao is not null end
        and case when $9::int is null then true else ue.id_diretoria_regional = $9::int end
      order by o.id_ocorrencia desc, ov.descricao, ue.descricao, ps.razao_social`;

    return this.queryFindAll(sql, [idPrestadorServico, idUnidadeEscolar, idOcorrenciaTipo, dataInicial, dataFinal, flagEncerrado, flagSomenteAtivos, idContratoList, idDiretoriaRegional]);

  }

  insert(_transaction, idOcorrenciaVariavel, observacao, acaoCorretiva, data, idFiscal, idUnidadeEscolar, idPrestadorServico, idMonitoramento) {

    const sql = `
      insert into ocorrencia (id_ocorrencia_variavel, observacao, acao_corretiva, data, id_fiscal, id_unidade_escolar, id_prestador_servico, id_monitoramento, data_hora_cadastro)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

    return this.insertWithReturn(sql, [idOcorrenciaVariavel, observacao, acaoCorretiva, data, idFiscal, idUnidadeEscolar, idPrestadorServico, idMonitoramento, new Date()], 'id_ocorrencia', _transaction);

  }

  inserirArquivo(_transaction, idOcorrencia, filename, filesize, caminho) {

    const sql = `
      insert into ocorrencia_arquivo (id_ocorrencia, filename, filesize, caminho)
      values ($1, $2, $3, $4)`;

    return this.query(sql, [idOcorrencia, filename, filesize, caminho], _transaction);

  }

  insertEquipe(_transaction, idOcorrencia, dCargo, quantidadeContratada, valorMensal, quantidadePresente, quantidadeAusente) {

    const sql = `
      insert into ocorrencia_equipe (id_ocorrencia, id_cargo, quantidade_contratada, valor_mensal, quantidade_presente, quantidade_ausente)
      values ($1, $2, $3, $4, $5, $6)`;

    return this.query(sql, [idOcorrencia, dCargo, quantidadeContratada, valorMensal, quantidadePresente, quantidadeAusente], _transaction);

  }

  encerrar(_transaction, idOcorrencia, dataHora, flagGerarDesconto, motivoNaoAtendido) {

    const sql = `
      update ocorrencia set data_hora_final = $1, flag_gerar_desconto = $2, observacao_final = $4 
      where id_ocorrencia = $3`;

    return this.query(sql, [dataHora, flagGerarDesconto, idOcorrencia, motivoNaoAtendido], _transaction);

  }

  removerArquivos(idOcorrencia, _transaction) {

    const sql = `
      delete from ocorrencia_arquivo 
      where id_ocorrencia = $1`;

    return this.query(sql, [idOcorrencia], _transaction);

  }

  removerEquipes(idOcorrencia, _transaction) {

    const sql = `
      delete from ocorrencia_equipe 
      where id_ocorrencia = $1`;

    return this.query(sql, [idOcorrencia], _transaction);

  }

  removerMensagens(idOcorrencia, _transaction) {

    const sql = `
      delete from ocorrencia_mensagem 
      where id_ocorrencia = $1`;

    return this.query(sql, [idOcorrencia], _transaction);

  }

  removerVinculoMonitoramento(idOcorrencia, _transaction) {

    const sql = `
      update monitoramento set id_ocorrencia = null 
      where id_ocorrencia = $1`;

    return this.query(sql, [idOcorrencia], _transaction);

  }

  remover(idOcorrencia, idUsuario, _transaction) {

    const sql = `
      update ocorrencia set id_usuario_remocao = $2, data_hora_remocao = $3
      where id_ocorrencia = $1`;

    return this.query(sql, [idOcorrencia, idUsuario, new Date()], _transaction);

  }

  reabrir(idOcorrencia) {

    const sql = `
      update ocorrencia set data_hora_final = null, flag_gerar_desconto = false
      where id_ocorrencia = $1`;

    return this.query(sql, [idOcorrencia]);

  }

  updateOcorrenciaRetroativa(idOcorrenciaRetroativa, idOcorrencia, idUsuario, _transaction) {
    const sql = `update ocorrencia_retroativa set id_ocorrencia = $2, id_prestador_servico = $3, status_ocorrencia_retroativa = 'I' 
    where id_ocorrencia_retroativa = $1`;

    return this.query(sql, [idOcorrenciaRetroativa, idOcorrencia, idUsuario], _transaction);
  }

}

module.exports = OcorrenciaDao;