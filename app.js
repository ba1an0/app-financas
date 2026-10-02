// === SISTEMA DE MODO ESCURO ===
const html = document.documentElement;
const iconeTema = document.getElementById('iconeTema');

if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    html.classList.add('dark');
    if(iconeTema) { iconeTema.classList.replace('ph-moon', 'ph-sun'); }
} else {
    html.classList.remove('dark');
}

window.toggleTema = function() {
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.theme = 'light';
        iconeTema.classList.replace('ph-sun', 'ph-moon');
    } else {
        html.classList.add('dark');
        localStorage.theme = 'dark';
        iconeTema.classList.replace('ph-moon', 'ph-sun');
    }
}

// === FUNÇÕES DOS MODAIS ===
const modalFundo = document.getElementById('modalFundo');
const modalTransacao = document.getElementById('modalTransacao');
const modalEdicao = document.getElementById('modalEdicao');
const formTransacao = document.getElementById('formTransacao');
const formEdicao = document.getElementById('formEdicao');
const mesAtualDisplay = document.getElementById('mesAtualDisplay');

window.abrirModal = function() {
    modalFundo.classList.remove('hidden');
    setTimeout(() => { modalTransacao.classList.add('modal-active'); }, 10);
    document.getElementById('data').value = new Date().toISOString().split('T')[0];
};

window.fecharModais = function() {
    modalTransacao.classList.remove('modal-active');
    modalEdicao.classList.remove('modal-active');
    setTimeout(() => { modalFundo.classList.add('hidden'); }, 300);
};

window.toggleParcelas = function() {
    const tipo = document.getElementById('tipo').value;
    const categoria = document.getElementById('categoria').value;
    const divParcelas = document.getElementById('divParcelas');
    const labelValor = document.getElementById('labelValor');
    
    if (tipo === 'despesa' && categoria === 'cartao') {
        divParcelas.classList.remove('hidden');
        labelValor.textContent = "Valor da Parcela (R$)"; // MUDANÇA 1: AQUI
    } else {
        divParcelas.classList.add('hidden');
        document.getElementById('parcelas').value = 1;
        labelValor.textContent = "Valor Total (R$)";
    }
};

// === LÓGICA DE DATAS ===
let dataAtual = new Date(); 
const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

window.mudarMes = function(direcao) {
    dataAtual.setMonth(dataAtual.getMonth() + direcao);
    atualizarDisplayMes();
    carregarDados(); 
};

function atualizarDisplayMes() {
    if(mesAtualDisplay) {
        mesAtualDisplay.textContent = `${mesesNomes[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`;
    }
}
atualizarDisplayMes();

// Utilitários
const formatarDinheiro = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
const formatarData = (dataStr) => { const p = dataStr.split('-'); return `${p[2]}/${p[1]}`; };

// === SETUP SUPABASE ===
let meuBanco; 
try {
    const supabaseUrl = 'https://txmqbndqrcjglnavqtfk.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bXFibmRxcmNqZ2xuYXZxdGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4OTQ5MjMsImV4cCI6MjEwNjQ3MDkyM30.PWRQA7SVF811wC7KW1AcTTp6l98WQictczF8XO3CDDE';
    meuBanco = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (erro) {
    console.error("Erro crítico ao carregar as chaves:", erro);
}

// === SALVAR NOVA TRANSAÇÃO ===
if(formTransacao) {
    formTransacao.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tipo = document.getElementById('tipo').value;
        const categoria = document.getElementById('categoria').value;
        const descricao = document.getElementById('descricao').value;
        const valorDigitado = parseFloat(document.getElementById('valor').value); // É O VALOR FINAL
        const dataBase = document.getElementById('data').value;
        
        let qtdMeses = 1;
        if (categoria === 'cartao') {
            qtdMeses = parseInt(document.getElementById('parcelas').value) || 1;
        } else if (categoria === 'fixo') {
            qtdMeses = 60; 
        }

        const inserts = [];

        for (let i = 0; i < qtdMeses; i++) {
            let dataNova = new Date(dataBase);
            dataNova.setHours(12); 
            dataNova.setMonth(dataNova.getMonth() + i);
            
            let desc = descricao;
            if (categoria === 'cartao' && qtdMeses > 1) {
                desc = `${descricao} (${i + 1}/${qtdMeses})`;
            }
            
            inserts.push({
                tipo: tipo,
                categoria: categoria,
                descricao: desc,
                valor: valorDigitado, // MUDANÇA 1: Não divide mais. Pega o valor da parcela direto.
                data: dataNova.toISOString().split('T')[0]
            });
        }

        const { error } = await meuBanco.from('transacoes').insert(inserts);

        if (error) {
            alert('Erro ao salvar no banco de dados: ' + error.message);
        } else {
            formTransacao.reset();
            window.toggleParcelas();
            window.fecharModais();
            carregarDados();
        }
    });
}

// === CARREGAR DADOS NA TELA ===
async function carregarDados() {
    if(!meuBanco) return; 

    const ano = dataAtual.getFullYear();
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    
    const dataInicio = `${ano}-${mes}-01`;
    const dataFim = new Date(ano, dataAtual.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await meuBanco
        .from('transacoes')
        .select('*')
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .order('data', { ascending: true });

    if (error) {
        console.error("Erro ao puxar dados:", error);
        return;
    }

    let totais = { ganho: 0, despesa: 0 };
    const lista = document.getElementById('listaTransacoes');
    
    if(!lista) return;
    lista.innerHTML = '';

    if (data.length === 0) {
        lista.innerHTML = `<p class="text-center text-slate-400 mt-6 text-sm">Nenhuma transação neste mês.</p>`;
    }

    data.forEach(t => {
        totais[t.tipo] += parseFloat(t.valor);
        
        const isGanho = t.tipo === 'ganho';
        const corIcone = isGanho ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
        const icone = isGanho ? 'ph-trend-up' : (t.categoria === 'cartao' ? 'ph-credit-card' : 'ph-receipt');
        const sinal = isGanho ? '+' : '-';

        const item = document.createElement('div');
        item.className = 'bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between transition-colors duration-300';
        
        item.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full flex items-center justify-center ${corIcone}">
                    <i class="ph ${icone} text-2xl"></i>
                </div>
                <div>
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-100">${t.descricao}</p>
                    <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">${formatarData(t.data)} • <span class="capitalize">${t.categoria}</span></p>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <p class="text-sm font-bold ${isGanho ? 'text-green-600 dark:text-green-400' : 'text-slate-800 dark:text-slate-100'}">
                    ${sinal} ${formatarDinheiro(t.valor)}
                </p>
                <div class="flex gap-2 mt-1">
                    <button onclick="abrirModalEdicao('${t.id}')" class="text-slate-300 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition">
                        <i class="ph-fill ph-pencil-simple text-lg"></i>
                    </button>
                    <button onclick="deletarTransacao('${t.id}')" class="text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition">
                        <i class="ph-fill ph-trash text-lg"></i>
                    </button>
                </div>
            </div>
        `;
        lista.appendChild(item);
    });

    document.getElementById('totalGanhos').textContent = formatarDinheiro(totais.ganho);
    document.getElementById('totalDespesas').textContent = formatarDinheiro(totais.despesa);
    
    const saldo = totais.ganho - totais.despesa;
    document.getElementById('saldoTotal').textContent = formatarDinheiro(saldo);
}

// === DELETAR INTELIGENTE (Fixo e Cartão) ===
window.deletarTransacao = async function(id) {
    if(!meuBanco) return;

    const { data: transacao } = await meuBanco.from('transacoes').select('*').eq('id', id).single();
    if(!transacao) return;

    // Remove o (1/3) do nome para achar as irmãs dela
    const baseDesc = transacao.descricao.replace(/\s\(\d+\/\d+\)$/, '');

    if (transacao.categoria === 'fixo' || transacao.categoria === 'cartao') {
        const resposta = prompt(`Essa é uma transação do tipo ${transacao.categoria.toUpperCase()}.\n\nDigite 1 = Apagar APENAS neste mês\nDigite 2 = Apagar neste e em TODOS os próximos\n\n(Deixe em branco para cancelar)`);
        
        if (resposta === '1') {
            await meuBanco.from('transacoes').delete().eq('id', id);
        } else if (resposta === '2') {
            await meuBanco.from('transacoes')
                .delete()
                .eq('categoria', transacao.categoria)
                .gte('data', transacao.data)
                .ilike('descricao', `${baseDesc}%`);
        } else {
            return;
        }
    } else {
        if(confirm('Apagar essa transação?')) {
            await meuBanco.from('transacoes').delete().eq('id', id);
        }
    }
    carregarDados();
}

// === ABRIR MODAL DE EDIÇÃO ===
window.abrirModalEdicao = async function(id) {
    const { data: t } = await meuBanco.from('transacoes').select('*').eq('id', id).single();
    if(!t) return;
    
    document.getElementById('edit_id').value = t.id;
    document.getElementById('edit_desc_orig').value = t.descricao;
    document.getElementById('edit_cat_orig').value = t.categoria;
    document.getElementById('edit_data_orig').value = t.data;
    
    document.getElementById('edit_tipo').value = t.tipo;
    document.getElementById('edit_categoria').value = t.categoria;
    
    // Tira o (1/3) para mostrar limpo no input pro usuário
    const baseDesc = t.descricao.replace(/\s\(\d+\/\d+\)$/, '');
    document.getElementById('edit_descricao').value = baseDesc;
    
    document.getElementById('edit_valor').value = t.valor;
    document.getElementById('edit_data').value = t.data;
    
    modalFundo.classList.remove('hidden');
    setTimeout(() => { modalEdicao.classList.add('modal-active'); }, 10);
}

// === SALVAR EDIÇÃO INTELIGENTE (Fixo e Cartão) ===
if(formEdicao) {
    formEdicao.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('edit_id').value;
        const descOrig = document.getElementById('edit_desc_orig').value;
        const catOrig = document.getElementById('edit_cat_orig').value;
        const dataOrig = document.getElementById('edit_data_orig').value;

        const novoTipo = document.getElementById('edit_tipo').value;
        const novaCategoria = document.getElementById('edit_categoria').value;
        const novaDesc = document.getElementById('edit_descricao').value;
        const novoValor = parseFloat(document.getElementById('edit_valor').value);
        const novaData = document.getElementById('edit_data').value;

        const baseDescOrig = descOrig.replace(/\s\(\d+\/\d+\)$/, '');

        if (catOrig === 'fixo' || catOrig === 'cartao') {
            const resposta = prompt(`Editar transação ${catOrig.toUpperCase()}:\n\nDigite 1 = Editar APENAS esta\nDigite 2 = Editar esta e as PRÓXIMAS (atualiza valor e nome)\n\n(Deixe em branco para cancelar)`);
            
            if (resposta === '1') {
                // Remonta o (1/3) se ele existia originalmente e o cara só mudou a descrição de uma do meio
                let descAtualizada = novaDesc;
                const matchParcela = descOrig.match(/\s\(\d+\/\d+\)$/);
                if (matchParcela) descAtualizada = novaDesc + matchParcela[0];

                await meuBanco.from('transacoes').update({ tipo: novoTipo, categoria: novaCategoria, descricao: descAtualizada, valor: novoValor, data: novaData }).eq('id', id);
            
            } else if (resposta === '2') {
                // Puxa todas as filhas do futuro
                const { data: futuras } = await meuBanco.from('transacoes')
                    .select('*')
                    .eq('categoria', catOrig)
                    .gte('data', dataOrig)
                    .ilike('descricao', `${baseDescOrig}%`);

                for (let row of futuras) {
                    // Mágica do Regex: Se tiver parcela (2/3), ele salva. Senão fica sem.
                    let descRow = novaDesc;
                    const matchRow = row.descricao.match(/\s\(\d+\/\d+\)$/);
                    if (matchRow) descRow = novaDesc + matchRow[0];
                    
                    // Atualiza a data só na conta selecionada. Nas do futuro ele preserva o mês delas.
                    let dataUpdate = row.data;
                    if (row.id === id) dataUpdate = novaData;

                    await meuBanco.from('transacoes').update({
                        tipo: novoTipo,
                        categoria: novaCategoria,
                        descricao: descRow,
                        valor: novoValor,
                        data: dataUpdate
                    }).eq('id', row.id);
                }
            } else {
                return;
            }
        } else {
            // Edição simples para despesas variáveis
            await meuBanco.from('transacoes').update({ tipo: novoTipo, categoria: novaCategoria, descricao: novaDesc, valor: novoValor, data: novaData }).eq('id', id);
        }

        window.fecharModais();
        carregarDados();
    });
}

// Start
carregarDados();
