// === COLAR SUAS CHAVES DO SUPABASE AQUI ===
const supabaseUrl = 'https://txmqbndqrcjglnavqtfk.supabase.co/rest/v1/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bXFibmRxcmNqZ2xuYXZxdGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4OTQ5MjMsImV4cCI6MjEwNjQ3MDkyM30.PWRQA7SVF811wC7KW1AcTTp6l98WQictczF8XO3CDDE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements
const mesFiltro = document.getElementById('mesFiltro');
const modalFundo = document.getElementById('modalFundo');
const modalTransacao = document.getElementById('modalTransacao');
const formTransacao = document.getElementById('formTransacao');

// Setup Inicial do Filtro (Mês Atual)
const hoje = new Date();
mesFiltro.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
mesFiltro.addEventListener('change', carregarDados);

// Formatar Moeda
const formatarDinheiro = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
// Formatar Data (DD/MM)
const formatarData = (dataStr) => {
    const partes = dataStr.split('-');
    return `${partes[2]}/${partes[1]}`;
};

// Funções do Modal
function abrirModal() {
    modalFundo.classList.remove('hidden');
    // Pequeno delay para a animação rodar suave
    setTimeout(() => { modalTransacao.classList.add('modal-active'); }, 10);
}

function fecharModal() {
    modalTransacao.classList.remove('modal-active');
    setTimeout(() => { modalFundo.classList.add('hidden'); }, 300);
}

function toggleParcelas() {
    const tipo = document.getElementById('tipo').value;
    const categoria = document.getElementById('categoria').value;
    const divParcelas = document.getElementById('divParcelas');
    
    if (tipo === 'despesa' && categoria === 'cartao') {
        divParcelas.classList.remove('hidden');
    } else {
        divParcelas.classList.add('hidden');
        document.getElementById('parcelas').value = 1;
    }
}

// Salvar Dados
formTransacao.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const tipo = document.getElementById('tipo').value;
    const categoria = document.getElementById('categoria').value;
    const descricao = document.getElementById('descricao').value;
    const valorTotal = parseFloat(document.getElementById('valor').value);
    const dataBase = document.getElementById('data').value;
    const parcelas = parseInt(document.getElementById('parcelas').value) || 1;

    const valorParcela = valorTotal / parcelas;
    const inserts = [];

    for (let i = 0; i < parcelas; i++) {
        let dataNova = new Date(dataBase);
        dataNova.setMonth(dataNova.getMonth() + i);
        
        inserts.push({
            tipo: tipo,
            categoria: categoria,
            descricao: parcelas > 1 ? `${descricao} (${i + 1}/${parcelas})` : descricao,
            valor: valorParcela,
            data: dataNova.toISOString().split('T')[0]
        });
    }

    const { error } = await supabase.from('transacoes').insert(inserts);

    if (error) {
        alert('Erro ao salvar: ' + error.message);
    } else {
        formTransacao.reset();
        toggleParcelas();
        fecharModal();
        carregarDados();
    }
});

// Carregar Dados da Tela
async function carregarDados() {
    const [ano, mes] = mesFiltro.value.split('-');
    const dataInicio = `${ano}-${mes}-01`;
    const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .order('data', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    let totais = { ganho: 0, despesa: 0 };
    const lista = document.getElementById('listaTransacoes');
    lista.innerHTML = '';

    if (data.length === 0) {
        lista.innerHTML = `<p class="text-center text-slate-400 mt-6 text-sm">Nenhuma transação neste mês.</p>`;
    }

    data.forEach(t => {
        totais[t.tipo] += parseFloat(t.valor);
        
        // Visual de acordo com o tipo
        const isGanho = t.tipo === 'ganho';
        const corIcone = isGanho ? 'text-green-500 bg-green-50' : 'text-red-500 bg-red-50';
        const icone = isGanho ? 'ph-trend-up' : (t.categoria === 'cartao' ? 'ph-credit-card' : 'ph-receipt');
        const sinal = isGanho ? '+' : '-';

        const item = document.createElement('div');
        item.className = 'bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between';
        
        item.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full flex items-center justify-center ${corIcone}">
                    <i class="ph ${icone} text-2xl"></i>
                </div>
                <div>
                    <p class="text-sm font-bold text-slate-800">${t.descricao}</p>
                    <p class="text-xs text-slate-400 font-medium">${formatarData(t.data)} • <span class="capitalize">${t.categoria}</span></p>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <p class="text-sm font-bold ${isGanho ? 'text-green-600' : 'text-slate-800'}">
                    ${sinal} ${formatarDinheiro(t.valor)}
                </p>
                <button onclick="deletarTransacao('${t.id}')" class="text-slate-300 hover:text-red-500 transition">
                    <i class="ph-fill ph-trash text-lg"></i>
                </button>
            </div>
        `;
        lista.appendChild(item);
    });

    // Atualiza Totais
    document.getElementById('totalGanhos').textContent = formatarDinheiro(totais.ganho);
    document.getElementById('totalDespesas').textContent = formatarDinheiro(totais.despesa);
    
    const saldo = totais.ganho - totais.despesa;
    document.getElementById('saldoTotal').textContent = formatarDinheiro(saldo);
}

// Deletar Transação
window.deletarTransacao = async function(id) {
    if(confirm('Apagar essa transação?')) {
        await supabase.from('transacoes').delete().eq('id', id);
        carregarDados();
    }
}

// Start
carregarDados();
