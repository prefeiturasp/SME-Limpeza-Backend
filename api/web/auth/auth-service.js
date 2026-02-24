const ctrl = require('rfr')('core/controller.js');
const utils = require('rfr')('core/utils/utils.js');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

const UsuarioDao = require('../usuario/usuario/usuario-dao');
const UnidadeEscolarDao = require('../unidade-escolar/unidade-escolar-dao');

const usuarioDao = new UsuarioDao();
const unidadeEscolarDao = new UnidadeEscolarDao();

const UsuarioCargoConstants = require('../../../core/constants/usuario-cargo.constantes');

exports.authenticate = authenticate;
exports.enviarEmailRecuperacao = enviarEmailRecuperacao;
exports.buscarTokenRecuperacao = buscarTokenRecuperacao;
exports.atualizarSenha = atualizarSenha;

async function authenticate(req, res) {

  const { email, senha } = req.body;

  if (!email || !senha) {
    return await ctrl.gerarRetornoErro(res);
  }

  const usuario = await usuarioDao.findDetalhadoByEmail(email);

  if (usuario && usuario.flagPodeLogar) {

    let hashSenha = bcrypt.compareSync(senha, usuario.senha);

    if (hashSenha) {
      usuario.flagFiscal = [
        UsuarioCargoConstants.FISCAL_TITULAR,
        UsuarioCargoConstants.FISCAL_SUPLENTE
      ].includes(parseInt(usuario.usuarioCargo.id));

      if (usuario.usuarioOrigem.codigo === 'ue') {
        usuario.unidadeEscolar = await unidadeEscolarDao.buscar(usuario.idOrigemDetalhe);
      }

      const token = gerarToken(usuario);
      delete usuario.senha;
      delete usuario.id;
      return await ctrl.gerarRetornoOk(res, { token, usuario });

    }

  }

  await ctrl.gerarRetornoErro(res, 'E-mail ou senha inválidos.');

}

async function enviarEmailRecuperacao(req, res) {

  if (!req.body.email) {
    return await ctrl.gerarRetornoErro(res);;
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    const usuario = await usuarioDao.findDetalhadoByEmail(req.body.email);

    if (!usuario || !usuario.flagPodeLogar) {
      await ctrl.finalizarTransaction(false, _transaction);
      return await ctrl.gerarRetornoErro(res, 'Nenhum usuário encontrado com o e-mail informado.');
    }

    const token = await uuidv4();
    await usuarioDao.insertRedefinicaoSenha(usuario.id, token);
    const linkRecuperacao = process.env.FRONTEND_URL + '/recuperacao-senha/' + token;

    await ctrl.enviarEmail(req.body.email, 'Redefina sua senha', `
            Olá,
            <br><br>
            Você solicitou a redefinição da sua senha!
            <br><br>
            <a href="${linkRecuperacao}" target="_blank">Clique aqui</a> para continuar com a redefinição.
            <br><br><br>
            Se você tiver um problema com o botão de ativação, clique com o botão direito nele e copie e cole o URL em um navegador.
            <br><br>
            E-mail enviado automaticamente, favor não responder.
        `);

    await ctrl.finalizarTransaction(true, _transaction);
    return await ctrl.gerarRetornoOk(res, 'E-mail de recuperação enviado com sucesso.');

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res, 'Erro ao enviar e-mail de recuperação de senha.');
  }

}

async function buscarTokenRecuperacao(req, res) {

  if (!req.params.token) {
    return await ctrl.gerarRetornoErro(res);
  }

  try {

    let usuario = await usuarioDao.findByTokenRecuperacao(req.params.token);

    if (!usuario) {
      return await ctrl.gerarRetornoErro(res, 'Nenhuma solicitação de recuperação encontrada com o token informado.');
    }

    usuario.flagTokenExpirado = (moment().diff(moment(usuario.dataHoraInsercao), 'hours')) > 24;
    return await ctrl.gerarRetornoOk(res, usuario);

  } catch (error) {
    console.log(error);
    return await ctrl.gerarRetornoErro(res, 'Erro ao localizar token de recuperação');
  }

}

async function atualizarSenha(req, res) {

  const { idUsuario, token, senha } = req.body;

  if (!req.params.id || !idUsuario || !token || !senha || req.params.id != idUsuario) {
    return await ctrl.gerarRetornoErro(res);
  }

  const _transaction = await ctrl.iniciarTransaction();

  try {

    let usuario = await usuarioDao.findByTokenRecuperacao(token);

    if (!usuario || usuario.id != idUsuario) {
      return await ctrl.gerarRetornoErro(res, 'Nenhuma solicitação de recuperação encontrada com o token informado.');
    }

    let hashSenha = bcrypt.hashSync(senha, 10);

    await usuarioDao.atualizarSenhaUsuario(idUsuario, hashSenha, _transaction);
    await usuarioDao.setarTokenRecuperado(usuario.idUsuarioRecuperacao, _transaction);
    await ctrl.finalizarTransaction(true, _transaction);
    return await ctrl.gerarRetornoOk(res);

  } catch (error) {
    console.log(error);
    await ctrl.finalizarTransaction(false, _transaction);
    return await ctrl.gerarRetornoErro(res, 'Erro ao localizar token de recuperação');
  }

}

function gerarToken(usuario) {
  return jwt.sign({ idUsuario: usuario.id }, process.env.JWT_SECRET_KEY, { expiresIn: '10h' });
}