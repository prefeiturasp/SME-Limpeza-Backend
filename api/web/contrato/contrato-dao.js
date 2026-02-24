const GenericDao = require('rfr')('core/generic-dao.js');

class ContratoDao extends GenericDao {

  constructor() {
    super('contrato');
  }

  buscar(id) {
    return this.queryFindOne(`
      with unidades as (
        select * from contrato_unidade_escolar
        where id_contrato = $1
      )
      select c.id_contrato as id, c.descricao, c.codigo, c.data_inicial, c.data_final, c.nome_responsavel, c.email_responsavel,
        c.id_prestador_servico, c.valor_total, c.numero_pregao, c.nome_lote, c.modelo::text, json_agg(u) as unidade_escolar_lista
      from contrato c
      left join unidades u using (id_contrato)
      where c.id_contrato = $1
      group by c.id_contrato, c.descricao, c.codigo, c.data_inicial, c.data_final, c.nome_responsavel, c.email_responsavel
      order by c.descricao asc
    `, [id]);
  }

  buscarReajustes(id) {
    return this.queryFindAll(`
      select *
      from contrato_reajuste cr
      where cr.id_contrato = $1
      order by cr.data_inicial
    `, [id]);
  }

  buscarEquipe(id, idUnidadeEscolar) {
    return this.queryFindAll(`
      select c.id_cargo, c.id_cargo as id, c.descricao, ce.quantidade, ce.valor_mensal
      from contrato_equipe ce
      join cargo c using (id_cargo)
      where ce.id_contrato = $1 and ce.id_unidade_escolar = $2
      order by c.descricao
    `, [id, idUnidadeEscolar]);
  }

  buscarVencimentoProximo(quantidadeDias, dataAtual) {
    return this.queryFindAll(`
      select 
        c.descricao, 
        c.codigo,
        c.data_final,
        (data_final - $1::date) as dias,
        row_to_json(ps) as prestador_servico
      from contrato c
      join prestador_servico ps using (id_prestador_servico)
      where (data_final - $1::date) between 0 and $2::int
    `, [dataAtual, quantidadeDias]);
  }

  datatable(codigo, idPrestadorServico, length, start) {

    const sql = `
      select count(c.*) over() as records_total, c.id_contrato as id, c.descricao, c.codigo, c.data_inicial, c.data_final, c.valor_total,
        json_build_object('razao_social', ps.razao_social, 'cnpj', ps.cnpj) as prestador_servico, count(cue) as quantidade_unidades_escolar
      from contrato c
      join prestador_servico ps using (id_prestador_servico)
      left join contrato_unidade_escolar cue on cue.id_contrato = c.id_contrato
      where case when $1::text is null then true else c.codigo ilike ('%' || $1::text || '%') end
        and case when $2::int is null then true else c.id_prestador_servico = $2::int end
      group by c.id_contrato, c.descricao, c.codigo, c.data_inicial, c.data_final, ps.razao_social, ps.cnpj
      order by c.data_inicial desc, c.data_final desc, substring(c.codigo from '([0-9]+)')::bigint asc, c.codigo
      limit $3 offset $4
    `;

    return this.queryFindAll(sql, [codigo, idPrestadorServico, length, start]);

  }

  comboTodos() {
    return this.queryFindAll(`
      select c.id_contrato as id, c.descricao, c.codigo
      from contrato c
      order by substring(c.codigo from '([0-9]+)')::bigint asc, c.codigo
    `, []);
  }

  insert(_transaction, descricao, codigo, dataInicial, dataFinal, nomeResponsavel, emailResponsavel, idPrestadorServico, valorTotal, numeroPregao, nomeLote, modelo) {
    return this.insertWithReturn(`
      insert into contrato (descricao, codigo, data_inicial, data_final, nome_responsavel, email_responsavel, id_prestador_servico, valor_total, numero_pregao, nome_lote, modelo) 
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::int)
    `, [descricao, codigo, dataInicial, dataFinal, nomeResponsavel, emailResponsavel, idPrestadorServico, valorTotal, numeroPregao, nomeLote, modelo], 'id_contrato', _transaction);
  }

  insertUnidadeEscolar(_transaction, id, idUnidadeEscolar, valor, dataInicial, dataFinal) {
    return this.query(`
      insert into contrato_unidade_escolar (
        id_contrato, 
        id_unidade_escolar, 
        valor,
        data_inicial,
        data_final
      ) values ($1, $2, $3, $4, $5)
    `, [id, idUnidadeEscolar, valor, dataInicial, dataFinal], _transaction);
  }

  insertEquipe(_transaction, id, idUnidadeEscolar, idCargo, quantidade, valor) {
    return this.query(`
      insert into contrato_equipe (
        id_contrato, 
        id_unidade_escolar,
        id_cargo,
        quantidade,
        valor_mensal
      ) values ($1, $2, $3, $4, $5)
    `, [id, idUnidadeEscolar, idCargo, quantidade, valor], _transaction);
  }

  insertReajuste(_transaction, idContrato, dataInicial, percentual) {
    return this.query(`
      insert into contrato_reajuste (
        id_contrato, 
        data_inicial, 
        percentual,
        flag_ativo
      ) values ($1, $2, $3, $4)
    `, [idContrato, dataInicial, percentual, true], _transaction);
  }

  atualizar(_transaction, id, descricao, codigo, dataInicial, dataFinal, nomeResponsavel, emailResponsavel, idPrestadorServico, valorTotal, numeroPregao, nomeLote, modelo) {
    return this.query(`
      update contrato set descricao = $1, codigo = $2, data_inicial = $3, data_final= $4, nome_responsavel = $5, 
        email_responsavel = $6, id_prestador_servico = $7, valor_total = $8, numero_pregao = $9, nome_lote = $10,
        modelo = $11::int
      where id_contrato = $12
    `, [descricao, codigo, dataInicial, dataFinal, nomeResponsavel, emailResponsavel, idPrestadorServico, valorTotal, numeroPregao, nomeLote, modelo, id], _transaction);
  }

  removerUnidadesEscolares(_transaction, idContrato) {

    const sql = `
      delete from contrato_unidade_escolar 
      where id_contrato = $1`;

    return this.query(sql, [idContrato], _transaction);

  }

  removerEquipes(_transaction, idContrato) {

    const sql = `
      delete from contrato_equipe
      where id_contrato = $1`;

    return this.query(sql, [idContrato], _transaction);

  }

  removerReajuste(_transaction, idContrato, idContratoReajuste) {

    const sql = `
      delete from contrato_reajuste
      where id_contrato = $1 and id_contrato_reajuste = $2`;

    return this.query(sql, [idContrato, idContratoReajuste], _transaction);
  }

  removerReajustes(_transaction, idContrato) {

    const sql = `
      delete from contrato_reajuste
      where id_contrato = $1`;

    return this.query(sql, [idContrato], _transaction);
  }

  removerUsuariosSME(_transaction, idContrato) {

    const sql = `
      delete from usuario_sme_contrato
      where id_contrato = $1`;

    return this.query(sql, [idContrato], _transaction);
  }

  remover(_transaction, id) {

    const sql = `
      delete from contrato 
      where id_contrato = $1`;

    return this.query(sql, [id], _transaction);

  }

  buscarDetalheContrato(id) {
    return this.queryFindAll(`
      select cue.id_unidade_escolar as id
      from contrato c
      join contrato_unidade_escolar cue using (id_contrato)
      where c.id_contrato = $1
    `, [id]);
  }

  buscarRelatoriosGerenciais(id) {

    const sql = `
      select * from relatorio_gerencial
      where id_contrato = $1`;

    return this.queryFindAll(sql, [id]);

  }

}

module.exports = ContratoDao;