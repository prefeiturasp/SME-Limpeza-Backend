const express = require('express');

const agendamentoAutomaticoService = require('./agendamento-automatico');
const relatorioGerencialService = require('./gerar-relatorio-gerencial');
const fechamentoAutomaticoOcorrenciasService = require('./fechamento-automatico-ocorrencias');

require('express-group-routes');

const app = express();

app.group('/api/system', (app) => {

  app.use((req, res, next) => {

    if (req.headers.host.split(':')[0] === 'localhost') {
      next();
    }

  });

  app.route('/agendar-monitoramentos-automaticos').get(agendamentoAutomaticoService);
  app.route('/gerar-relatorio-gerencial').get(relatorioGerencialService);
  app.route('/fechamento-automatico-ocorrencias').get(fechamentoAutomaticoOcorrenciasService);

});

module.exports = app;