
const conn = require('../../../core/database');
const moment = require('moment');
iniciarMonitoramentos();

async function iniciarMonitoramentos(req, res) {

    const _transaction = await conn.iniciarTransaction();

    try {

        const unidadeEscolarList = await buscarUnidadesEscolaresAtivas();

        for(let unidadeEscolar of unidadeEscolarList) {
            let planoTrabalhoList = await buscarPlanoTrabalhoPorUnidadeEscolar(_transaction, unidadeEscolar.idUnidadeEscolar);
            for(let planoTrabalho of planoTrabalhoList) {
                await criarMonitoramento(_transaction, unidadeEscolar, planoTrabalho);
            }
        }

        await conn.finalizarTransaction(true, _transaction);
        console.log('Monitoramentos agendados com sucesso.');
        // res.send('Monitoramentos agendados com sucesso.');

    } catch(error) {
        console.log(error);
        await conn.finalizarTransaction(false, _transaction);
        return res.status(500).send('Erro ao agendar monitoramentos.');
    }

}

async function buscarUnidadesEscolaresAtivas() {

    return await conn.findAll(`
        SELECT ue.id_unidade_escolar, ue.descricao, ue.id_contrato_atual,
            JSON_BUILD_OBJECT('id_contrato', c.id_contrato, 'descricao', c.descricao, 'codigo', c.codigo) AS contrato,
            JSON_BUILD_OBJECT('id_prestador_servico', ps.id_prestador_servico, 'razao_social', ps.razao_social, 'cnpj', ps.cnpj) AS prestador_servico
        FROM unidade_escolar ue
        JOIN contrato c ON c.id_contrato = ue.id_contrato_atual
        JOIN prestador_servico ps USING (id_prestador_servico)
        --JOIN plano_trabalho_unidade_escolar ptue ON ptue.id_unidade_escolar = ue.id_unidade_escolar
        WHERE ue.flag_ativo
    `);

}

async function buscarPlanoTrabalhoPorUnidadeEscolar(_transaction, idUnidadeEscolar) {

    return await conn.findAll(`
        SELECT 
            id_plano_trabalho_unidade_escolar AS id_plano_trabalho, 
            id_ambiente_unidade_escolar, 
            id_periodicidade,
            id_turno,
            descricao AS atividades
        FROM plano_trabalho_unidade_escolar
        WHERE flag_ativo AND id_unidade_escolar = $1
    `, [idUnidadeEscolar], _transaction);

}

async function criarMonitoramento(_transaction, unidadeEscolar, planoTrabalho) {

    const flagPodeCriar = await verificarPeriodicidade(planoTrabalho);

    if(flagPodeCriar) {

        await conn.query(`
            INSERT INTO monitoramento (
                id_prestador_servico,
                id_unidade_escolar,
                id_ambiente_unidade_escolar,
                id_periodicidade,
                id_turno,
                atividades,
                data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            unidadeEscolar.prestadorServico.idPrestadorServico,
            unidadeEscolar.idUnidadeEscolar,
            planoTrabalho.idAmbienteUnidadeEscolar,
            planoTrabalho.idPeriodicidade,
            planoTrabalho.idTurno,
            planoTrabalho.atividades,
            new Date()
        ], _transaction);

    }

}

async function verificarPeriodicidade(planoTrabalho) {

    const dataAtual = new Date();
    const flagDiaSemana = ([0,6].indexOf(dataAtual.getDay()) == -1);
    const flagInicioSemana = dataAtual.getDay() == 1;
    const flagInicioMes = moment(dataAtual).clone().startOf('month').format('DD/MM/YYYY') == moment(dataAtual).format('DD/MM/YYYY');

    if(planoTrabalho.idPeriodicidade == 1 && flagDiaSemana) {
        return true;
    }

    if(planoTrabalho.idPeriodicidade == 2 && flagInicioSemana) {
        return true;
    }

    if(planoTrabalho.idPeriodicidade == 3 && flagInicioMes) {
        return true;
    }

    return false;

}