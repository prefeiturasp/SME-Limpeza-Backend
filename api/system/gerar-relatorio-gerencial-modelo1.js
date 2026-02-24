const conn = require('rfr')('core/database');
const path = require('path');
const moment = require('moment');
require('dotenv').config({ path: path.join(__dirname, '.env') });

exports._gerar = async (_transaction, unidadeEscolar, dataInicial, dataFinal, valorBruto) => {

  const { idUnidadeEscolar, idPrestadorServico, idContrato } = unidadeEscolar;
  const mes = moment(dataInicial).format('MM');
  const ano = moment(dataInicial).format('YYYY');

  const ID_RELATORIO_GERENCIAL = await inserirRelatorioGerencial(
    _transaction, idPrestadorServico, idUnidadeEscolar, mes, ano,
    valorBruto, idContrato, dataInicial.format('YYYY-MM-DD'), dataFinal.format('YYYY-MM-DD'));

  await inserirDetalheTipo(_transaction, ID_RELATORIO_GERENCIAL);
  await inserirDetalheVariavel(_transaction, ID_RELATORIO_GERENCIAL);

};

async function inserirRelatorioGerencial(_transaction, idPrestadorServico, idUnidadeEscolar, mes, ano, valorBruto, idContrato, dataInicial, dataFinal) {

  return await conn.insertWithReturn(`
      insert into relatorio_gerencial (
        id_prestador_servico, id_unidade_escolar, mes, ano,
        valor_bruto, valor_liquido, id_contrato, contrato_modelo,
        data_inicial, data_final
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
    idPrestadorServico, idUnidadeEscolar, mes, ano,
    valorBruto, valorBruto, idContrato, 1,
    dataInicial, dataFinal
  ], 'id_relatorio_gerencial', _transaction);

}

async function inserirDetalheTipo(_transaction, idRelatorioGerencial) {

  await conn.query(`
    insert into relatorio_gerencial_detalhe_tipo (id_relatorio_gerencial, id_ocorrencia_tipo, peso)
    select $1 as id_relatorio_gerencial, ot.id_ocorrencia_tipo, ot.peso
    from ocorrencia_tipo ot
    where ot.flag_ativo and ot.contrato_modelo = 1
    order by ot.id_ocorrencia_tipo
  `, [idRelatorioGerencial], _transaction);

}

async function inserirDetalheVariavel(_transaction, idRelatorioGerencial) {

  await conn.query(`
    insert into relatorio_gerencial_detalhe_variavel (id_relatorio_gerencial, id_ocorrencia_variavel, peso)
    select $1 as id_relatorio_gerencial, ov.id_ocorrencia_variavel, ov.peso
    from ocorrencia_variavel ov
    join ocorrencia_tipo ot on ot.id_ocorrencia_tipo = ov.id_ocorrencia_tipo
    where ot.flag_ativo and ot.contrato_modelo = 1
    order by ov.id_ocorrencia_variavel
  `, [idRelatorioGerencial], _transaction);

}