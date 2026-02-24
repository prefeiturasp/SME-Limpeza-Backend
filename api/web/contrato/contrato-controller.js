
const router = require('express').Router();
const service = require('./contrato-service');
const multer = require('multer');
const upload = multer({ dest: __dirname + '/upload' });

router.route('/tabela').get(service.tabela);
router.route('/combo').get(service.combo);
router.route('/combo-todos').get(service.comboTodos);
router.route('/combo-equipe').get(service.comboEquipe);
router.route('/vencimento-proximo/:quantidadeDias').get(service.buscarVencimentoProximo);

router.post('/carregar-arquivo-unidade-escolar',
  upload.single('file'),
  service.carregarArquivoUnidadeEscolar);

router.post('/carregar-arquivo-cargo',
  upload.single('file'),
  service.carregarArquivoCargo);

router.route('/:id').get(service.buscar);
router.route('/').post(service.inserir);
router.route('/:id').patch(service.atualizar);
router.route('/:id').delete(service.remover);

module.exports = router;