
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const JWT = require('jsonwebtoken');

const UsuarioDao = require('../usuario/usuario/usuario-dao');
const usuarioDao = new UsuarioDao();

exports._usuario = async function (req, res, next) {

    try {
        
        let token = req.headers.authorization.split(" ")[1];
        let decoded = JWT.verify(token, process.env.JWT_SECRET_KEY);
        
        req.userData = decoded;

        let usuario = await usuarioDao.findDetalhadoById(decoded.idUsuario);

        if(usuario) {
            req.userData.nome = usuario.nome;
            req.userData.idOrigemDetalhe = usuario.idOrigemDetalhe;
            req.userData.cargo = usuario.usuarioCargo;
            req.userData.origem = usuario.usuarioOrigem;
        } else {
            return retonarNaoAutorizado(res, 'Auth failed');
        }

        next();

    } catch (error) {
        return retonarNaoAutorizado(res, 'Auth failed');
    }

};

function retonarNaoAutorizado(res, string) {
    return res.status(401).json({
        status: false, msg: string
    });
}