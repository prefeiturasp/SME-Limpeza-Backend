
require('express-group-routes');

const express = require('express');

const checkAuthorization = require('./auth/check-auth.js');

const app = express();

app.use('/api/app/auth', require('./auth/auth-controller'));

app.group("/api/app", (app) => {

  app.use(checkAuthorization._prestadorServico);
  app.use(checkAuthorization._unidadeEscolar);

  app.use('/unidade-escolar', require('./unidade-escolar/unidade-escolar-controller'));
  app.use('/monitoramento', require('./monitoramento/monitoramento-controller'));

});

module.exports = app;