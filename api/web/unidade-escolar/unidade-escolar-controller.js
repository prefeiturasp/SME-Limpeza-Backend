
const router = require('express').Router();
const service = require('./unidade-escolar-service');
const multer = require('multer');
const upload = multer({ dest: __dirname + '/upload' });

router.route('/tabela').get(service.tabela);
router.route('/combo/').get(service.combo);
router.route('/combo-dre/:idDiretoriaRegional').get(service.comboPorDRE);
router.route('/combo-todos/').get(service.comboTodos);
router.route('/combo-tipo-escola').get(service.comboTipoEscola);
router.route('/combo-detalhado').get(service.comboDetalhado);
router.route('/combo-detalhado-todos').get(service.carregarComboDetalhadoTodos);
router.route('/:id').get(service.buscar);

router.post('/importar/:idDiretoriaRegional',
    upload.single('file'),
    service.importar);

router.route('/').post(service.inserir);
router.route('/:id').patch(service.atualizar);
router.route('/:id').delete(service.remover);

module.exports = router;