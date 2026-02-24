
const router = require('express').Router();
const service = require('./diretoria-regional-service');
const multer = require('multer');
const upload = multer({ dest: __dirname + '/upload' });

router.route('/combo').get(service.combo);
router.route('/combo-todos').get(service.comboTodos);
router.route('/tabela').get(service.tabela);
router.route('/:id').get(service.buscar);

router.post('/importar',
    upload.single('file'),
    service.importar);

router.route('/').post(service.inserir);
router.route('/:id').patch(service.atualizar);
router.route('/:id').delete(service.remover);

module.exports = router;