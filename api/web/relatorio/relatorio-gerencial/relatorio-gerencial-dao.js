const GenericDao = require('rfr')('core/generic-dao.js');

class RelatorioGerencialDao extends GenericDao {

  constructor() {
    super('relatorio_gerencial');
  }

  buscar(id, _transaction) {

    const sql = `
      with filtro as (
        select *
        from relatorio_gerencial
        where id_relatorio_gerencial = $1
      ),
      ocorrencias as (
        select o.id_ocorrencia, o.id_ocorrencia_variavel, o.data,
          o.data_hora_final is not null as flag_encerrado, o.data_hora_cadastro,
          u.nome as nome_fiscal
        from ocorrencia o
        join filtro f
          on f.id_prestador_servico = o.id_prestador_servico 
          and f.id_unidade_escolar = o.id_unidade_escolar
          and case when f.data_inicial is null 
            then f.mes = extract(month from o.data) and f.ano = extract(year from o.data)
            else o.data::date between f.data_inicial and f.data_final end
        join usuario u on u.id_usuario = o.id_fiscal
        where o.flag_gerar_desconto and o.data_hora_remocao is null
        order by o.data
      ),
      dados0 as (
        select rgdv.id_ocorrencia_variavel, ov.descricao, ov.descricao_conforme, ov.descricao_conforme_com_ressalva, 
          ov.descricao_nao_conforme, ov.id_ocorrencia_tipo, rgdv.observacao, rgdv.nota, rgdv.peso, rgdv.pontuacao, 
          rgdv.id_ocorrencia_situacao, 
          to_json(array_remove(array_agg(o order by o.data), null)) as ocorrencias
        from relatorio_gerencial_detalhe_variavel rgdv 
        join ocorrencia_variavel ov using (id_ocorrencia_variavel)
        left join ocorrencias o on o.id_ocorrencia_variavel = rgdv.id_ocorrencia_variavel
        where rgdv.id_relatorio_gerencial = $1
        group by 1, 2,3, 4, 5, 6, 7, 8, 9, 10, 11
        order by ov.descricao
      ),
      dados1 as (
        select d0.id_ocorrencia_variavel, d0.descricao, d0.descricao_conforme, d0.descricao_conforme_com_ressalva, 
          d0.descricao_nao_conforme, d0.id_ocorrencia_tipo, d0.observacao, d0.nota, d0.peso, d0.pontuacao, 
          d0.ocorrencias, to_json(os) as situacao
        from dados0 d0 
        left join ocorrencia_situacao os using (id_ocorrencia_situacao)
        order by d0.descricao
      ),
      dados2 as (
        select rgdt.id_relatorio_gerencial, ot.id_ocorrencia_tipo, ot.descricao, rgdt.pontuacao_parcial, 
          rgdt.peso, rgdt.pontuacao_final, to_json(array_agg(v order by v.descricao)) as variaveis
        from relatorio_gerencial_detalhe_tipo rgdt 
        join ocorrencia_tipo ot using (id_ocorrencia_tipo)
        join dados1 v on v.id_ocorrencia_tipo = ot.id_ocorrencia_tipo
        where rgdt.id_relatorio_gerencial = $1
        group by 1, 2, 3, 4, 5, 6
        order by ot.descricao
      ),
      juntos as (
        select rg.id_relatorio_gerencial, rg.mes, rg.ano, rg.id_prestador_servico, rg.id_unidade_escolar, 
          rg.contrato_modelo, rg.pontuacao_final, 
          coalesce(rg.fator_desconto, 0) as fator_desconto, 
          rg.valor_bruto, 
          coalesce(rg.valor_liquido, 0) as valor_liquido,
          coalesce(rg.desconto_glosa_rh, 0) as desconto_glosa_rh,
          rg.data_hora_aprovacao_fiscal,
          rg.id_usuario_aprovacao_fiscal,
          rg.data_hora_aprovacao_dre,
          rg.id_usuario_aprovacao_dre,
          to_json(array_agg(d2 order by d2.descricao)) as detalhe
        from relatorio_gerencial rg
        join dados2 d2 on d2.id_relatorio_gerencial = rg.id_relatorio_gerencial
        where rg.id_relatorio_gerencial = $1
        group by 1, 2, 3, 4, 5, 6, 7, 8
      )
      select 
        rg.id_relatorio_gerencial, 
        to_char(rg.mes, 'fm00') as mes, 
        rg.ano, 
        rg.contrato_modelo,
        rg.detalhe, 
        rg.pontuacao_final, 
        rg.fator_desconto, 
        rg.valor_bruto, 
        rg.valor_liquido,
        rg.desconto_glosa_rh,
        rg.data_hora_aprovacao_fiscal,
        rg.id_usuario_aprovacao_fiscal,
        u1.nome as nome_usuario_aprovacao_fiscal,
        rg.data_hora_aprovacao_dre,
        rg.id_usuario_aprovacao_dre,
        u2.nome as nome_usuario_aprovacao_dre,
        json_build_object('id', ue.id_unidade_escolar, 'descricao', ue.descricao, 'codigo', ue.codigo, 'tipo', te.descricao) as unidade_escolar,
        json_build_object('id', ps.id_prestador_Servico, 'razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
      from juntos rg
      join prestador_servico ps using (id_prestador_servico)
      join unidade_escolar ue using (id_unidade_escolar)
      join tipo_escola te using (id_tipo_escola)
      left join usuario u1 on u1.id_usuario = rg.id_usuario_aprovacao_fiscal
      left join usuario u2 on u2.id_usuario = rg.id_usuario_aprovacao_dre`;

    return this.queryFindOne(sql, [id], _transaction);

  }

  buscarOcorrenciasAbertas(id, _transaction) {
    return this.queryFindAll(`
      with filtro as (
        select * from relatorio_gerencial
        where id_relatorio_gerencial = $1
      )
      select o.*
      from ocorrencia o
      join filtro f
        on f.id_prestador_servico = o.id_prestador_servico 
        and f.id_unidade_escolar = o.id_unidade_escolar
        and case when f.data_inicial is null 
          then f.mes = extract(month from o.data) and f.ano = extract(year from o.data)
          else o.data::date between f.data_inicial and f.data_final end
      where o.data_hora_final is null and o.data_hora_remocao is null
    `, [id], _transaction);
  }

  buscarPorCompetenciaAndContrato(ano, mes, idUnidadeEscolar, idPrestadorServico, idContrato, contratoModelo) {
    return this.queryFindOne(`
      select * from relatorio_gerencial rg 
      where ano = $1 and mes = $2
        and rg.id_unidade_escolar = $3
        and rg.id_prestador_servico = $4
        and rg.id_contrato = $5
        and rg.contrato_modelo = $6
    `, [ano, mes, idUnidadeEscolar, idPrestadorServico, idContrato, contratoModelo]);
  }

  buscarEquipeAlocada(idRelatorioGerencial) {

    const sql = `
      select descricao, quantidade_contratada, (quantidade_contratada * 21.74) as quantidade_contratada_mensal, valor_mensal, quantidade_ausente, valor_desconto
      from relatorio_gerencial_equipe
      where id_relatorio_gerencial = $1 -- and quantidade_ausente > 0
      order by descricao
    `;

    return this.queryFindAll(sql, [idRelatorioGerencial]);

  }

  buscarConfiguracao(idUnidadeEscolar, idContrato) {

    const sql = `
      select 
        ue.id_unidade_escolar, 
        ue.descricao, 
        ps.id_prestador_servico,
        c.id_contrato,
        c.modelo,
        cue.valor,
        cue.data_inicial,
        cue.data_final,
        json_build_object('id_prestador_servico', ps.id_prestador_servico, 'razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
      from unidade_escolar ue
      join contrato_unidade_escolar cue on cue.id_unidade_escolar = ue.id_unidade_escolar 
      join contrato c on c.id_contrato = cue.id_contrato
      join prestador_servico ps using (id_prestador_servico)
      where ue.id_unidade_escolar = $1 and c.id_contrato = $2`;

    return this.queryFindOne(sql, [idUnidadeEscolar, idContrato]);

  }

  datatable(idPrestadorServico, idUnidadeEscolar, ano, mes, length, start, ehPrestadorServico, idUsuario, idContratoList, idDiretoriaRegional) {

    const sql = `
      with unidades as (
        select distinct(id_unidade_escolar)
        from contrato_unidade_escolar
        where case when $5::int[] is null then true else id_contrato = any($5::int[]) end
      )
      select 
        count(rg) over() as records_total, 
        rg.id_relatorio_gerencial as id, 
        to_char(rg.mes, 'fm00') as mes,
        rg.ano, 
        rg.pontuacao_final, 
        rg.fator_desconto, 
        (rg.id_usuario_aprovacao_fiscal is not null) as flag_aprovado_fiscal,
        (rg.id_usuario_aprovacao_dre is not null) as flag_aprovado_dre,
        json_build_object('descricao', ue.descricao, 'codigo', ue.codigo, 'tipo', te.descricao) as unidade_escolar,
        json_build_object('razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico
      from unidades u
      join relatorio_gerencial rg using (id_unidade_escolar)
      join prestador_servico ps using (id_prestador_servico)
      join unidade_escolar ue using (id_unidade_escolar)
      join tipo_escola te on te.id_tipo_escola = ue.id_tipo_escola
      ${ehPrestadorServico == true ? `
        join usuario_prestador_unidade_escolar upue 
          on upue.id_unidade_escolar = ue.id_unidade_escolar 
          and upue.id_usuario = ${idUsuario}` : ''}
      where case when $1::int is null then true else rg.id_prestador_servico = $1::int end
        and case when $2::int is null then true else rg.id_unidade_escolar = $2::int end
        and case when $3::int is null then true else rg.ano = $3::int end
        and case when $4::int is null then true else rg.mes = $4::int end
        and case when $6::int is null then true else ue.id_diretoria_regional = $6::int end
      order by rg.ano desc, rg.mes desc 
      limit $7 offset $8`;

    return this.queryFindAll(sql, [idPrestadorServico, idUnidadeEscolar, ano, mes, idContratoList, idDiretoriaRegional, length, start]);

  }

  atualizarDetalheOcorrenciaVariavel(_transaction, idRelatorioGerencial, idOcorrenciaVariavel, idOcorrenciaSituacao, observacao, nota, peso, pontuacao) {
    return this.query(`
      update relatorio_gerencial_detalhe_variavel set 
        id_ocorrencia_situacao = $1,
        observacao = $2,
        nota = $3,
        peso = $4,
        pontuacao = $5
      where id_relatorio_gerencial = $6 and id_ocorrencia_variavel = $7
    `, [idOcorrenciaSituacao, observacao, nota, peso, pontuacao, idRelatorioGerencial, idOcorrenciaVariavel], _transaction);
  }

  atualizarDetalheOcorrenciaTipo(_transaction, idRelatorioGerencial, idOcorrenciaTipo, pontuacaoParcial, pontuacaoFinal) {
    return this.query(`
      update relatorio_gerencial_detalhe_tipo set 
        pontuacao_parcial = $1,
        pontuacao_final = $2
      where id_relatorio_gerencial = $3 and id_ocorrencia_tipo = $4
    `, [pontuacaoParcial, pontuacaoFinal, idRelatorioGerencial, idOcorrenciaTipo], _transaction);
  }

  atualizarTotal(_transaction, idRelatorioGerencial, pontuacaoTotal, fatorDesconto, valorLiquido) {
    return this.query(`
      update relatorio_gerencial set 
        pontuacao_final  = $1,
        fator_desconto = $2,
        valor_liquido = $3
      where id_relatorio_gerencial = $4
    `, [pontuacaoTotal, fatorDesconto, valorLiquido, idRelatorioGerencial], _transaction);
  }

  consolidar(idRelatorioGerencial, idUsuario, dataHoraConsolidacao) {
    return this.query(`
      update relatorio_gerencial set 
        id_usuario_aprovacao_fiscal  = $1,
        data_hora_aprovacao_fiscal = $2
      where id_relatorio_gerencial = $3
    `, [idUsuario, dataHoraConsolidacao, idRelatorioGerencial]);
  }

  desconsolidar(idRelatorioGerencial) {
    return this.query(`
      update relatorio_gerencial set 
        id_usuario_aprovacao_fiscal = null,
        data_hora_aprovacao_fiscal = null
      where id_relatorio_gerencial = $1
    `, [idRelatorioGerencial]);
  }

  aprovar(idRelatorioGerencial, idUsuario, dataHoraConsolidacao) {
    return this.query(`
      update relatorio_gerencial set 
        id_usuario_aprovacao_dre = $1,
        data_hora_aprovacao_dre = $2
      where id_relatorio_gerencial = $3
    `, [idUsuario, dataHoraConsolidacao, idRelatorioGerencial]);
  }

  reverterAprovacao(idRelatorioGerencial) {
    return this.query(`
      update relatorio_gerencial set 
        id_usuario_aprovacao_dre = null,
        data_hora_aprovacao_dre = null
      where id_relatorio_gerencial = $1
    `, [idRelatorioGerencial]);
  }

  atualizarValorBruto(_transaction, idRelatorioGerencial, novoValorBruto) {
    return this.query(`
      update relatorio_gerencial
      set valor_bruto = $2
      where id_relatorio_gerencial = $1
    `, [idRelatorioGerencial, novoValorBruto], _transaction);
  }

  removerDetalheTipo(_transaction, idRelatorioGerencial) {
    return this.query(`
      delete from relatorio_gerencial_detalhe_tipo 
      where id_relatorio_gerencial = $1
    `, [idRelatorioGerencial], _transaction);
  }

  removerDetalheVariavel(_transaction, idRelatorioGerencial) {
    return this.query(`
      delete from relatorio_gerencial_detalhe_variavel
      where id_relatorio_gerencial = $1
    `, [idRelatorioGerencial], _transaction);
  }

  removerDetalheEquipeAlocada(_transaction, idRelatorioGerencial) {
    return this.query(`
      delete from relatorio_gerencial_equipe
      where id_relatorio_gerencial = $1
    `, [idRelatorioGerencial], _transaction);
  }

  remover(_transaction, idRelatorioGerencial) {
    return this.query(`
      delete from relatorio_gerencial
      where id_relatorio_gerencial = $1
    `, [idRelatorioGerencial], _transaction);
  }

  calcularDescontoGlosaRh(_transaction, idRelatorioGerencial) {

    const sql = `
      select sum(valor_desconto) as total
      from relatorio_gerencial_equipe
      where id_relatorio_gerencial = $1
    `;

    return this.queryFindOne(sql, [idRelatorioGerencial], _transaction);

  }

  atualizarValorLiquido(_transaction, idRelatorioGerencial, novoValorLiquido) {
    return this.query(`
      update relatorio_gerencial
      set valor_liquido = $2
      where id_relatorio_gerencial = $1
    `, [idRelatorioGerencial, novoValorLiquido], _transaction);
  }

  buscarRelatorioPorData(idUnidadeEscolar, idPrestadorServico, mesDoisMesesAnteriores, anoDoisMesesAnteriores, mesUmMesAnterior, anoUmMesAnterior) {
    return this.queryFindAll(`
      select * from relatorio_gerencial
      where id_unidade_escolar = $1
        and id_prestador_servico = $2
        and (
          (mes = $3::int and ano = $4::int)
          OR
          (mes = $5::int and ano = $6::int)
        )
    `, [idUnidadeEscolar, idPrestadorServico, mesDoisMesesAnteriores, anoDoisMesesAnteriores, mesUmMesAnterior, anoUmMesAnterior]);
  }

  inserir(_transaction, idPrestadorServico, idUnidadeEscolar, mes, ano, valorTotal, idContrato) {

    const sql = `
      insert into relatorio_gerencial (
        id_prestador_servico, id_unidade_escolar, mes, ano,
        valor_bruto, valor_liquido, id_contrato
      ) values ($1, $2, $3, $4, $5, $5, $6)`;

    return this.insertWithReturn(sql, [idPrestadorServico, idUnidadeEscolar, mes, ano, valorTotal, idContrato], 'id_relatorio_gerencial', _transaction);

  }

  inserirDetalheTipo(_transaction, idRelatorioGerencial) {

    const sql = `
      insert into relatorio_gerencial_detalhe_tipo (id_relatorio_gerencial, id_ocorrencia_tipo, peso)
      select $1 as id_relatorio_gerencial, ot.id_ocorrencia_tipo, ot.peso
      from ocorrencia_tipo ot
      where ot.flag_ativo
      order by ot.id_ocorrencia_tipo`;

    return this.query(sql, [idRelatorioGerencial], _transaction);

  }

  inserirDetalheVariavel(_transaction, idRelatorioGerencial) {

    const sql = `
      insert into relatorio_gerencial_detalhe_variavel (id_relatorio_gerencial, id_ocorrencia_variavel, peso)
      select $1 as id_relatorio_gerencial, ov.id_ocorrencia_variavel, ov.peso
      from ocorrencia_variavel ov
      join ocorrencia_tipo ot on ot.id_ocorrencia_tipo = ov.id_ocorrencia_tipo
      where ot.flag_ativo
      order by ov.id_ocorrencia_variavel`;

    return this.query(sql, [idRelatorioGerencial], _transaction);

  }

}

module.exports = RelatorioGerencialDao;