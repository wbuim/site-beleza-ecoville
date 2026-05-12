const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
require('dotenv').config();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'segredo-super-secreto-wcode',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './public/images/promos/temp';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const id = file.fieldname.replace('promo', '');
        cb(null, `temp-promo${id}.jpg`); 
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png'];
        if (tiposPermitidos.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato inválido'));
        }
    }
});

// --- ARQUIVOS DE BANCO DE DADOS (JSON) ---
const ARQUIVO_PROMOS = path.join(__dirname, 'data', 'promocoes.json');
const ARQUIVO_SERVICOS = path.join(__dirname, 'data', 'servicos.json');
const ARQUIVO_USUARIOS = path.join(__dirname, 'data', 'usuarios.json');
const ARQUIVO_ESTERILIZACAO = path.join(__dirname, 'data', 'esterilizacao.json');
const ARQUIVO_ATENDIMENTOS = path.join(__dirname, 'data', 'atendimentos.json');

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));

function lerDadosPromocoes() {
    try {
        if (!fs.existsSync(ARQUIVO_PROMOS)) return [];
        return JSON.parse(fs.readFileSync(ARQUIVO_PROMOS, 'utf8'));
    } catch (e) { return []; }
}
function salvarDadosPromocoes(dados) {
    fs.writeFileSync(ARQUIVO_PROMOS, JSON.stringify(dados, null, 2));
}

function lerServicos() {
    try {
        if (!fs.existsSync(ARQUIVO_SERVICOS)) return { "Cabelo": [], "Manicure e Pedicure": [], "Estética": [] };
        return JSON.parse(fs.readFileSync(ARQUIVO_SERVICOS, 'utf8'));
    } catch (e) { return {}; }
}
function salvarServicos(dados) {
    fs.writeFileSync(ARQUIVO_SERVICOS, JSON.stringify(dados, null, 2));
}

function lerUsuarios() {
    try {
        if (!fs.existsSync(ARQUIVO_USUARIOS)) return [];
        return JSON.parse(fs.readFileSync(ARQUIVO_USUARIOS, 'utf8'));
    } catch (e) { return []; }
}
// NOVA FUNÇÃO: Salvar Usuários
function salvarUsuarios(dados) {
    fs.writeFileSync(ARQUIVO_USUARIOS, JSON.stringify(dados, null, 2));
}

function lerEsterilizacao() {
    try {
        if (!fs.existsSync(ARQUIVO_ESTERILIZACAO)) return [];
        return JSON.parse(fs.readFileSync(ARQUIVO_ESTERILIZACAO, 'utf8'));
    } catch (e) { return []; }
}
function salvarEsterilizacao(dados) {
    fs.writeFileSync(ARQUIVO_ESTERILIZACAO, JSON.stringify(dados, null, 2));
}

function lerAtendimentos() {
    try {
        if (!fs.existsSync(ARQUIVO_ATENDIMENTOS)) return [];
        return JSON.parse(fs.readFileSync(ARQUIVO_ATENDIMENTOS, 'utf8'));
    } catch (e) { return []; }
}
function salvarAtendimentos(dados) {
    fs.writeFileSync(ARQUIVO_ATENDIMENTOS, JSON.stringify(dados, null, 2));
}

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
function verificarAuth(req, res, next) {
    if (req.session.usuarioLogado) {
        next();
    } else {
        res.redirect('/login');
    }
}

// ================= ROTAS =================

app.get('/', (req, res) => {
    const listaServicos = lerServicos();
    res.render('index', { servicos: listaServicos });
});

app.get('/promocoes', (req, res) => {
    const listaPromos = lerDadosPromocoes();
    res.render('promocoes', { dados: listaPromos });
});

app.get('/chat', (req, res) => {
    res.render('chatbot');
});

app.get('/login', (req, res) => {
    res.render('login', { erro: null });
});

// LOGIN ATUALIZADO (REDIRECIONAMENTO INTELIGENTE)
app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;

    // 1. Senhas Mestras (do arquivo .env)
    if (usuario === process.env.USER_ADMIN && senha === process.env.PASS_ADMIN) {
        req.session.usuarioLogado = 'admin_master';
        req.session.nomeUsuario = 'Administrador(a)';
        req.session.perfil = 'admin';
        return res.redirect('/admin');
    }
    if (usuario === process.env.USER_ESTOQUE && senha === process.env.PASS_ESTOQUE) {
        req.session.usuarioLogado = 'estoque_master';
        req.session.nomeUsuario = 'Estoque Principal';
        req.session.perfil = 'estoque';
        return res.redirect('/estoque');
    }

    // 2. Usuários Dinâmicos (do banco de dados json)
    const usuarios = lerUsuarios();
    const userEncontrado = usuarios.find(u => u.usuario === usuario && u.senha === senha);
    
    if (userEncontrado) {
        req.session.usuarioLogado = userEncontrado.usuario;
        req.session.nomeUsuario = userEncontrado.nome;
        req.session.perfil = userEncontrado.perfil;
        
        // Redireciona de acordo com o perfil cadastrado
        if (userEncontrado.perfil === 'admin') return res.redirect('/admin');
        if (userEncontrado.perfil === 'estoque') return res.redirect('/estoque');
        return res.redirect('/manicure');
    }

    res.render('login', { erro: 'Usuário ou senha incorretos.' });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// PAINEL ADMIN (ENVIANDO USUARIOS PARA A TELA)
app.get('/admin', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'admin') return res.redirect('/');

    const listaPromos = req.session.tempTexts || lerDadosPromocoes();
    const listaServicos = lerServicos(); 
    const todosUsuarios = lerUsuarios();
    const manicures = todosUsuarios.filter(u => u.perfil === 'manicure');
    
    res.render('admin', { 
        servicosPromos: listaPromos, 
        servicos: listaServicos, 
        manicures: manicures,
        usuarios: todosUsuarios,
        erro: null
    });
});

// --- ROTAS DE GESTÃO DE USUÁRIOS (CRUD) ---
app.post('/admin/usuarios/adicionar', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'admin') return res.redirect('/');
    const { nome, usuario, senha, perfil } = req.body;
    let usuarios = lerUsuarios();
    
    // Só adiciona se o login não existir
    if (!usuarios.find(u => u.usuario === usuario)) {
        usuarios.push({ nome, usuario, senha, perfil });
        salvarUsuarios(usuarios);
    }
    res.redirect('/admin');
});

app.post('/admin/usuarios/editar', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'admin') return res.redirect('/');
    const { usuario_antigo, nome, usuario, senha, perfil } = req.body;
    let usuarios = lerUsuarios();
    
    const index = usuarios.findIndex(u => u.usuario === usuario_antigo);
    if (index !== -1) {
        usuarios[index] = { nome, usuario, senha, perfil };
        salvarUsuarios(usuarios);
    }
    res.redirect('/admin');
});

app.post('/admin/usuarios/remover', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'admin') return res.redirect('/');
    const { usuario } = req.body;
    let usuarios = lerUsuarios();
    usuarios = usuarios.filter(u => u.usuario !== usuario);
    salvarUsuarios(usuarios);
    res.redirect('/admin');
});
// ------------------------------------------

app.post('/admin/upload-preview', verificarAuth, (req, res) => {
    upload.any()(req, res, (err) => {
        const listaServicos = lerServicos();
        const listaPromos = req.session.tempTexts || lerDadosPromocoes();
        const todosUsuarios = lerUsuarios();
        const manicures = todosUsuarios.filter(u => u.perfil === 'manicure');

        if (err instanceof multer.MulterError) {
            let msgErro = 'Erro no upload.';
            if (err.code === 'LIMIT_FILE_SIZE') msgErro = '⚠️ A imagem é muito grande! O limite máximo é de 5MB.';
            return res.render('admin', { servicosPromos: listaPromos, servicos: listaServicos, manicures, usuarios: todosUsuarios, erro: msgErro });
        } else if (err) {
            return res.render('admin', { servicosPromos: listaPromos, servicos: listaServicos, manicures, usuarios: todosUsuarios, erro: '⚠️ Formato inválido!' });
        }

        const dadosAtuais = lerDadosPromocoes();
        req.session.tempTexts = dadosAtuais.map(p => ({ ...p, msg: req.body[`msg_${p.id}`] || p.msg }));
        res.redirect('/admin');
    });
});

app.post('/admin/adicionar-promocao', verificarAuth, (req, res) => {
    let dados = lerDadosPromocoes();
    const novoId = dados.length > 0 ? Math.max(...dados.map(p => p.id)) + 1 : 1;
    dados.push({ id: novoId, img: 'padrao.jpg', msg: 'Olá! Vi essa promoção no site e quero agendar.' });
    salvarDadosPromocoes(dados);
    delete req.session.tempTexts;
    res.redirect('/admin');
});

app.post('/admin/remover-promocao', verificarAuth, (req, res) => {
    let dados = lerDadosPromocoes();
    dados = dados.filter(p => p.id !== parseInt(req.body.id));
    salvarDadosPromocoes(dados);
    delete req.session.tempTexts;
    res.redirect('/admin');
});

app.post('/admin/publicar', verificarAuth, (req, res) => {
    const tempDir = './public/images/promos/temp';
    const finalDir = './public/images/promos';

    if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach(arquivo => {
            const id = arquivo.replace('temp-promo', '').replace('.jpg', '');
            fs.renameSync(path.join(tempDir, arquivo), path.join(finalDir, `promo${id}.jpg`));
        });
    }

    if (req.session.tempTexts) {
        let dadosReais = lerDadosPromocoes();
        const dadosAtualizados = dadosReais.map(real => {
            const temp = req.session.tempTexts.find(t => t.id === real.id);
            if (temp) {
                let nomeImagem = real.img;
                if (fs.existsSync(path.join(finalDir, `promo${real.id}.jpg`))) nomeImagem = `promo${real.id}.jpg`;
                return { ...real, msg: temp.msg, img: nomeImagem };
            }
            return real;
        });
        salvarDadosPromocoes(dadosAtualizados);
        delete req.session.tempTexts;
    }
    res.redirect('/promocoes');
});

app.post('/admin/adicionar-servico', verificarAuth, (req, res) => {
    const { categoria, nome, tempo, desc } = req.body;
    let servicos = lerServicos();
    if (servicos[categoria]) {
        servicos[categoria].push({ nome, tempo, desc });
        salvarServicos(servicos);
    }
    res.redirect('/admin');
});

app.post('/admin/remover-servico', verificarAuth, (req, res) => {
    const { categoria, index } = req.body;
    let servicos = lerServicos();
    if (servicos[categoria]) {
        servicos[categoria].splice(index, 1);
        salvarServicos(servicos);
    }
    res.redirect('/admin');
});

app.post('/admin/salvar-servicos', verificarAuth, (req, res) => {
    res.redirect('/admin');
});

// --- ROTAS DE ESTOQUE, MANICURE E RECEPÇÃO ---
app.get('/estoque', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'estoque' && req.session.perfil !== 'admin') return res.redirect('/');
    const dados = lerEsterilizacao();
    const pendentes_recebimento = dados.filter(r => r.status === 'Pendente');
    const pendentes_entrega = dados.filter(r => r.status === 'Aprovado'); 
    const manicures = lerUsuarios().filter(u => u.perfil === 'manicure');
    res.render('estoque', { pendentes_recebimento, pendentes_entrega, manicures });
});

app.get('/manicure', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'manicure' && req.session.perfil !== 'admin') return res.redirect('/');
    const meusRegistros = lerEsterilizacao().filter(r => r.manicure === req.session.nomeUsuario);
    res.render('manicure', { nome: req.session.nomeUsuario, registros: meusRegistros });
});

app.post('/manicure/enviar', verificarAuth, (req, res) => {
    let dados = lerEsterilizacao();
    const novoId = dados.length > 0 ? Math.max(...dados.map(d => d.id)) + 1 : 1;
    dados.push({
        id: novoId, manicure: req.session.nomeUsuario, quantidade: parseInt(req.body.quantidade),
        data_envio: new Date().toLocaleString('pt-BR'), status: 'Pendente',
        data_aprovacao: null, aprovado_por: null, edit_count: 0, historico_alteracoes: []
    });
    salvarEsterilizacao(dados);
    res.redirect('/manicure');
});

app.post('/manicure/editar', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'manicure' && req.session.perfil !== 'admin') return res.redirect('/');
    let dados = lerEsterilizacao();
    const index = dados.findIndex(d => d.id === parseInt(req.body.id) && d.manicure === req.session.nomeUsuario);
    if (index !== -1 && dados[index].status === 'Pendente' && (dados[index].edit_count || 0) < 2) {
        const qtdAntiga = dados[index].quantidade;
        dados[index].quantidade = parseInt(req.body.nova_quantidade);
        dados[index].edit_count = (dados[index].edit_count || 0) + 1;
        if (!dados[index].historico_alteracoes) dados[index].historico_alteracoes = [];
        dados[index].historico_alteracoes.push({ data: new Date().toLocaleString('pt-BR'), de: qtdAntiga, para: parseInt(req.body.nova_quantidade) });
        salvarEsterilizacao(dados);
    }
    res.redirect('/manicure');
});

app.get('/recepcao', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'recepcao' && req.session.perfil !== 'estoque' && req.session.perfil !== 'admin') return res.redirect('/');
    
    let registros = lerEsterilizacao().reverse(); 
    let atendimentos = lerAtendimentos().reverse();
    const { data_inicio, data_fim } = req.query;

    if (data_inicio && data_fim) {
        const formatarParaISO = (dataPtBr) => {
            if (!dataPtBr) return "";
            const dataParte = dataPtBr.split(',')[0];
            const [dia, mes, ano] = dataParte.split('/');
            return `${ano}-${mes}-${dia}`;
        };
        registros = registros.filter(r => {
            const dataEnvioISO = formatarParaISO(r.data_envio);
            return dataEnvioISO >= data_inicio && dataEnvioISO <= data_fim;
        });
        atendimentos = atendimentos.filter(a => a.data_referencia >= data_inicio && a.data_referencia <= data_fim);
    }

    // NOVIDADE: Cria um mapa somando todos os atendimentos daquela manicure no período
    const atendimentosMap = {};
    atendimentos.forEach(a => {
        atendimentosMap[a.manicure] = (atendimentosMap[a.manicure] || 0) + a.quantidade;
    });

    res.render('recepcao', { 
        registros, 
        atendimentosMap, // Enviando o cruzamento de dados para a tela
        perfil: req.session.perfil, 
        filtros: { data_inicio, data_fim } 
    });
});

app.post('/estoque/aprovar', verificarAuth, (req, res) => {
    let dados = lerEsterilizacao();
    const index = dados.findIndex(d => d.id === parseInt(req.body.id));
    if(index !== -1) {
        dados[index].status = 'Aprovado';
        dados[index].data_aprovacao = new Date().toLocaleString('pt-BR');
        dados[index].aprovado_por = req.session.usuarioLogado;
        salvarEsterilizacao(dados);
    }
    res.redirect('/estoque');
});

app.post('/estoque/devolver', verificarAuth, (req, res) => {
    let dados = lerEsterilizacao();
    const index = dados.findIndex(d => d.id === parseInt(req.body.id));
    if(index !== -1) {
        dados[index].status = 'Devolvido';
        dados[index].data_devolucao = new Date().toLocaleString('pt-BR');
        salvarEsterilizacao(dados);
    }
    res.redirect('/estoque');
});

app.post('/estoque/editar', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'estoque' && req.session.perfil !== 'admin') return res.redirect('/');
    let dados = lerEsterilizacao();
    const index = dados.findIndex(d => d.id === parseInt(req.body.id));
    if (index !== -1) {
        const qtdAntiga = dados[index].quantidade;
        dados[index].quantidade = parseInt(req.body.nova_quantidade);
        if (!dados[index].historico_alteracoes) dados[index].historico_alteracoes = [];
        dados[index].historico_alteracoes.push({ data: new Date().toLocaleString('pt-BR'), de: qtdAntiga, para: parseInt(req.body.nova_quantidade), autor: 'Estoque' });
        salvarEsterilizacao(dados);
    }
    res.redirect('/estoque');
});

app.post('/atendimentos/adicionar', verificarAuth, (req, res) => {
    if (req.session.perfil !== 'estoque' && req.session.perfil !== 'admin') return res.redirect('/');
    const { manicure, quantidade, data_referencia } = req.body;
    let dados = lerAtendimentos();
    const novoId = dados.length > 0 ? Math.max(...dados.map(d => d.id)) + 1 : 1;
    
    dados.push({
        id: novoId, manicure, quantidade: parseInt(quantidade), data_referencia,
        data_lancamento: new Date().toLocaleString('pt-BR'), inserido_por: req.session.usuarioLogado
    });
    
    salvarAtendimentos(dados);
    if (req.session.perfil === 'admin') return res.redirect('/admin');
    res.redirect('/estoque');
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});