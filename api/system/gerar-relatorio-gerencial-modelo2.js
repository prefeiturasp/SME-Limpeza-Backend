const conn = require('rfr')('core/database');
const path = require('path');
const moment = require('moment');
require('dotenv').config({ path: path.join(__dirname, '.env') });

exports._gerar = async (_transaction, unidadeEscolar, dataInicial, dataFinal, valorBruto) => {

  const { idUnidadeEscolar, idPrestadorServico, idContrato } = unidadeEscolar;
  const tetoGlosa = 0.072;

  const mes = moment(dataInicial).format('MM');
  const ano = moment(dataInicial).format('YYYY');

  let pontuacaoTotal = 0;
  let fatorDesconto = 0;

  const tipos = await buscarVariaveis(_transaction, idPrestadorServico, idUnidadeEscolar, dataInicial.format('YYYY-MM-DD'), dataFinal.format('YYYY-MM-DD'));

  for (let ot of tipos) {

    ot.pontuacao = 0;

    for (let v of ot.variaveis) {
      v.pontuacao = v.quantidadeOcorrencias / v.quantidadeMaxima * tetoGlosa;
      v.percentual = v.pontuacao > tetoGlosa ? tetoGlosa : v.pontuacao;
      v.pontuacaoFinal = v.peso - (v.percentual / tetoGlosa * v.peso);
      ot.pontuacao += v.pontuacaoFinal;
      fatorDesconto += v.percentual;
    }

    pontuacaoTotal += ot.pontuacao;

  }

  fatorDesconto = fatorDesconto > tetoGlosa ? tetoGlosa : fatorDesconto;

  const valorDesconto = valorBruto * fatorDesconto;
  const valorLiquido = parseFloat(valorBruto) - parseFloat(valorDesconto);
  const fatorDescontoFormatado = (fatorDesconto * 100);

  const idRelatorioGerencial = await inserirRelatorioGerencial(
    _transaction, idPrestadorServico, idUnidadeEscolar, mes, ano, valorBruto,
    valorLiquido, pontuacaoTotal, fatorDescontoFormatado,
    idContrato, dataInicial.format('YYYY-MM-DD'), dataFinal.format('YYYY-MM-DD'));

  await inserirEquipeAlocada(_transaction, idRelatorioGerencial, idContrato, idPrestadorServico, idUnidadeEscolar, dataInicial.format('YYYY-MM-DD'), dataFinal.format('YYYY-MM-DD'));

  let descontoGlosaRh = (await calcularDescontoGlosaRh(_transaction, idRelatorioGerencial)).total || 0.0;

  if (parseFloat(descontoGlosaRh) > (parseFloat(valorBruto) * 0.86)) {
    descontoGlosaRh = (parseFloat(valorBruto) * 0.86);
  }

  const novoValorLiquido = parseFloat(valorLiquido) - (parseFloat(descontoGlosaRh) || 0.0);
  const novoValorLiquidoFinal = novoValorLiquido >= 0.0 ? novoValorLiquido : 0.0;

  await atualizarValorLiquido(_transaction, idRelatorioGerencial, novoValorLiquidoFinal);
  await atualizarValorGlosaRh(_transaction, idRelatorioGerencial, descontoGlosaRh);

  for (let ot of tipos) {

    await inserirDetalheTipo(_transaction, idRelatorioGerencial, ot.idOcorrenciaTipo, ot.peso, ot.pontuacao);
    for (let v of ot.variaveis) {
      await inserirDetalheVariavel(_transaction, idRelatorioGerencial, v.idOcorrenciaVariavel, v.peso, v.pontuacaoFinal);
    }

  }

};

async function inserirRelatorioGerencial(_transaction, idPrestadorServico, idUnidadeEscolar, mes, ano, valorBruto,
  valorLiquido, pontuacaoTotal, fatorDesconto, idContrato, dataInicial, dataFinal) {

  return await conn.insertWithReturn(`
      insert into relatorio_gerencial (
        id_prestador_servico, id_unidade_escolar, mes, ano,
        valor_bruto, valor_liquido, pontuacao_final, fator_desconto, 
        id_contrato, contrato_modelo, data_inicial, data_final
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
    idPrestadorServico, idUnidadeEscolar, mes, ano,
    valorBruto, valorLiquido, pontuacaoTotal, fatorDesconto,
    idContrato, 2, dataInicial, dataFinal
  ], 'id_relatorio_gerencial', _transaction);

}

async function buscarVariaveis(_transaction, idPrestadorServico, idUnidadeEscolar, dataInicial, dataFinal) {

  const sql = `
    with variaveis as (
      select ov.id_ocorrencia_tipo,
        ov.id_ocorrencia_variavel, ov.descricao, ov.peso, 
        ov.quantidade_maxima, count(o.*) as quantidade_ocorrencias
      from ocorrencia_variavel ov
      left join ocorrencia o 
        on o.id_ocorrencia_variavel = ov.id_ocorrencia_variavel
        and o.id_prestador_servico = $1
        and o.id_unidade_escolar = $2
        and o.data::date between $3 and $4
        and o.flag_gerar_desconto
        and o.data_hora_remocao is null
      where not ov.flag_equipe_alocada
      group by 1, 2, 3, 4
      order by ov.peso
    )
    select ot.id_ocorrencia_tipo, ot.peso, to_json(array_agg(v)) as variaveis
    from variaveis v
    join ocorrencia_tipo ot on ot.id_ocorrencia_tipo = v.id_ocorrencia_tipo
    where ot.flag_ativo and ot.contrato_modelo = 2
    group by 1, 2
    order by 2`;

  return await conn.findAll(sql, [idPrestadorServico, idUnidadeEscolar, dataInicial, dataFinal], _transaction);

}

async function inserirEquipeAlocada(_transaction, idRelatorioGerencial, idContrato, idPrestadorServico, idUnidadeEscolar, dataInicial, dataFinal) {

  const sql1 = `
    insert into relatorio_gerencial_equipe
    with dados as (
      select oe.id_cargo, sum(oe.quantidade_ausente) as quantidade_ausente
      from ocorrencia o
      join ocorrencia_equipe oe on oe.id_ocorrencia = o.id_ocorrencia
      join ocorrencia_variavel ov on ov.id_ocorrencia_variavel = o.id_ocorrencia_variavel and ov.flag_equipe_alocada
      join ocorrencia_tipo ot on ot.id_ocorrencia_tipo = ov.id_ocorrencia_tipo and ot.contrato_modelo = 2
      where o.flag_gerar_desconto
        and o.id_prestador_servico = $3
        and o.id_unidade_escolar = $4
        and o.data::date between $5 and $6
        and o.data_hora_remocao is null
      group by 1
      order by 1
    )
    select
    $1::int as id_relatorio_gerencial,
      c.id_cargo,
      c.descricao,
      ce.quantidade as quantidade_contratada,
      ce.valor_mensal,
    coalesce(sum(d.quantidade_ausente), 0) as quantidade_ausente,
    coalesce(sum(d.quantidade_ausente), 0) * (ce.valor_mensal / 21.74) as valor_desconto
    from contrato_equipe ce
    join cargo c on c.id_cargo = ce.id_cargo
    left join dados d on d.id_cargo = c.id_cargo
    where ce.id_contrato = $2 and ce.id_unidade_escolar = $4
    group by 1, 2, 3, 4, 5
    order by 1, 2`;

  const result = await conn.query(sql1, [idRelatorioGerencial, idContrato, idPrestadorServico, idUnidadeEscolar, dataInicial, dataFinal], _transaction);

  if (result.rowCount === 0) {
    return;
  }

  const sql2 = `
    insert into relatorio_gerencial_equipe
    select
      $1::int as id_relatorio_gerencial,
	    ce.id_cargo,
	    cargo.descricao,
	    ce.quantidade,
	    ce.valor_mensal,
	    0::numeric as quantidade_ausente,
	    0::numeric as valor_desconto
    from contrato_equipe ce
    join contrato c using (id_contrato)
    join cargo using (id_cargo)
    left join relatorio_gerencial_equipe rge on rge.id_cargo = ce.id_cargo
    left join relatorio_gerencial rg 
      on rg.id_relatorio_gerencial = rge.id_relatorio_gerencial
      and rg.id_relatorio_gerencial = $1
    where c.id_contrato = $2
      and ce.id_unidade_escolar = $3
      and rge.id_cargo is null`;

  await conn.query(sql2, [idRelatorioGerencial, idContrato, idUnidadeEscolar], _transaction);

}

async function calcularDescontoGlosaRh(_transaction, idRelatorioGerencial) {

  const sql = `
    select sum(valor_desconto) as total
    from relatorio_gerencial_equipe
    where id_relatorio_gerencial = $1
  `;

  return await conn.findOne(sql, [idRelatorioGerencial], _transaction);

}

async function inserirDetalheTipo(_transaction, idRelatorioGerencial, idOcorrenciaTipo, peso, pontuacao) {

  await conn.query(`
    insert into relatorio_gerencial_detalhe_tipo (id_relatorio_gerencial, id_ocorrencia_tipo, peso, pontuacao_final)
    values ($1, $2, $3, $4)
  `, [idRelatorioGerencial, idOcorrenciaTipo, peso, pontuacao], _transaction);

}

async function inserirDetalheVariavel(_transaction, idRelatorioGerencial, idOcorrenciaVariavel, peso, pontuacao) {

  await conn.query(`
    insert into relatorio_gerencial_detalhe_variavel (id_relatorio_gerencial, id_ocorrencia_variavel, peso, pontuacao)
    values($1, $2, $3, $4)
  `, [idRelatorioGerencial, idOcorrenciaVariavel, peso, pontuacao], _transaction);

}

async function atualizarValorLiquido(_transaction, idRelatorioGerencial, novoValorLiquido) {

  const sql = `
    update relatorio_gerencial
    set valor_liquido = $2
    where id_relatorio_gerencial = $1`;

  return conn.query(sql, [idRelatorioGerencial, novoValorLiquido], _transaction);

}

async function atualizarValorGlosaRh(_transaction, idRelatorioGerencial, novoValorGlosaRh) {

  const sql = `
    update relatorio_gerencial
    set desconto_glosa_rh = $2
    where id_relatorio_gerencial = $1`;

  return conn.query(sql, [idRelatorioGerencial, novoValorGlosaRh], _transaction);

}