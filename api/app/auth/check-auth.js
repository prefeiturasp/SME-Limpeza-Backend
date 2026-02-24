
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const JWT = require('jsonwebtoken');
const PrestadorServicoDao = require('../prestador-servico/prestador-servico-dao');

const prestadorServicoDao = new PrestadorServicoDao();

exports._prestadorServico = async function (req, res, next) {

  try {

    const token = req.headers.authorization.split(" ")[1];
    const decoded = JWT.verify(token, process.env.JWT_SECRET_KEY);

    req.idPrestadorServico = decoded.idPrestadorServico;

    let prestadorServico = await prestadorServicoDao.findById(decoded.idPrestadorServico);
    if (!prestadorServico || !prestadorServico.flagAtivo) {
      return retonarNaoAutorizado(res, 'Auth failed');
    }

    next();

  } catch (error) {
    return retonarNaoAutorizado(res, 'Auth failed');
  }

};

exports._unidadeEscolar = async function (req, res, next) {

  try {

    const idPrestadorServico = req.idPrestadorServico;
    const idUnidadeEscolar = parseInt(req.headers.ue);

    const unidadeEscolarPrestador = await prestadorServicoDao.buscarUnidadeEscolar(idPrestadorServico, idUnidadeEscolar);
    if (!unidadeEscolarPrestador) {
      return retonarNaoAutorizado(res, 'Auth failed');
    }

    req.idUnidadeEscolar = idUnidadeEscolar;
    next();

  } catch (error) {
    console.log(error);
    return retonarNaoAutorizado(res, 'Auth failed');
  }

};

function retonarNaoAutorizado(res, string) {
  return res.status(401).json({
    status: false, msg: string
  });
}