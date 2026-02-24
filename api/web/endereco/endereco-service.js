const ctrl = require('rfr')('core/controller');
const geo = require('rfr')('core/utils/geo.js');

exports.buscarPorCep = buscarPorCep;
exports.buscarCoordenadas = buscarCoordenadas;

async function buscarPorCep(req, res) {
    
    if(!req.params.cep) {
        return await ctrl.gerarRetornoErro(res, 'CEP inválido.');
    }

    try {

        const endereco = await geo.buscarCep(req.params.cep);

        if(endereco.uf != 'SP') {
            return await ctrl.gerarRetornoErro(res, 'O CEP informado não é do estado de São Paulo.');
        }

        if(endereco.municipio != 'São Paulo') {
            return await ctrl.gerarRetornoErro(res, 'O CEP informado não é da cidade de São Paulo.');
        }

        await ctrl.gerarRetornoOk(res, endereco);

    } catch(e) {    
        console.error(e);
        await ctrl.gerarRetornoErro(res, 'Houve um erro ao localizar os dados do CEP.');
    }

}

async function buscarCoordenadas(req, res) {

    if(!req.body.endereco) {
        return await ctrl.gerarRetornoErro(res, 'Endereço inválido.');
    }

    try {
        const coordenadas = await geo.buscarCoordenadas(req.body.endereco);
        await ctrl.gerarRetornoOk(res, coordenadas);
    } catch(e) {    
        console.error(e);
        await ctrl.gerarRetornoErro(res, 'Houve um erro ao buscar as coordenadas por endereço.');
    }

}