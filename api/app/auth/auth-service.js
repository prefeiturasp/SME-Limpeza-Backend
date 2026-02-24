
const ctrl = require('rfr')('core/controller');
const utils = require('rfr')('core/utils/utils.js');
const JWT = require('jsonwebtoken');

const PrestadorServicoDao = require('../prestador-servico/prestador-servico-dao');
const UnidadeEscolarDao = require('../unidade-escolar/unidade-escolar-dao');

const prestadorServicoDao = new PrestadorServicoDao();
const unidadeEscolarDao = new UnidadeEscolarDao();

exports.authenticate = async (req, res) => {

  const { cnpj, codigoUnidadeEscolar, senha } = req.body

  const prestadorServico = await prestadorServicoDao.findByCnpj(cnpj);

  if (!prestadorServico || senha !== prestadorServico.senhaAplicativo) {
    return await ctrl.gerarRetornoErro(res, 'Credenciais de acesso inválidas.');
  }

  const unidadeEscolar = await unidadeEscolarDao.buscarPorCodigoAndPrestadorServico(prestadorServico.idPrestadorServico, codigoUnidadeEscolar);

  if (!unidadeEscolar) {
    return await ctrl.gerarRetornoErro(res, 'Sem permissão para a Unidade Escolar informada.');
  }

  await ctrl.gerarRetornoOk(res, {
    prestadorServico: { cnpj: prestadorServico.cnpj, razaoSocial: prestadorServico.razaoSocial },
    idUnidadeEscolar: unidadeEscolar.id,
    accessToken: gerarToken(prestadorServico)
  });

}

function gerarToken(prestadorServico) {
  return JWT.sign(
    { idPrestadorServico: prestadorServico.idPrestadorServico },
    process.env.JWT_SECRET_KEY, { expiresIn: '30d' }
  );
}