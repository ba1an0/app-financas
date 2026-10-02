// Funções de Interface
const modalFundo = document.getElementById('modalFundo');
const modalTransacao = document.getElementById('modalTransacao');
const formTransacao = document.getElementById('formTransacao');
const mesAtualDisplay = document.getElementById('mesAtualDisplay');

window.abrirModal = function() {
    modalFundo.classList.remove('hidden');
    setTimeout(() => { modalTransacao.classList.add('modal-active'); }, 10);
    document.getElementById('data').value = new Date().toISOString().split('T')[0];
};

window.fecharModal = function() {
    modalTransacao.classList.remove('modal-active');
    setTimeout(() => { modalFundo.classList.add('hidden'); }, 300);
};

window.toggleParcelas = function() {
    const tipo = document.getElementById('tipo').value;
    const categoria = document.getElementById('categoria').value;
    const divParcelas = document.getElementById('divParcelas');
    
    if (tipo === 'despesa' && categoria === 'cartao') {
        divParcelas.classList.remove('hidden');
    } else {
        divParcelas.classList.add('hidden');
        document.getElementById('parcelas').value = 1;
    }
};

// Lógica de Datas
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

// Salvar Transação no Banco
if(formTransacao) {
    formTransacao.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tipo = document.getElementById('tipo').value;
        const categoria = document.getElementById('categoria').value;
        const descricao = document.getElementById('descricao').value;
        const valorTotal = parseFloat(document.getElementById('valor').value);
        const dataBase = document.getElementById('data').value;
        
        // MÁGICA DOS MESES: Define quantas vezes vai repetir dependendo do tipo
        let qtdMeses = 1;
        if (categoria === 'cartao') {
            qtdMeses = parseInt(document.getElementById('parcelas').value) || 1;
        } else if (categoria === 'fixo') {
            qtdMeses = 24; // Projeta a despesa/ganho fixo por 5 anos (60 meses)
        }

        // MÁGICA DO VALOR: Cartão divide, Fixo/Variável repete o valor cheio
        const valorFinal = (categoria === 'cartao') ? (valorTotal / qtdMeses) : valorTotal;
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
                valor: valorFinal,
                data: dataNova.toISOString().split('T')[0]
            });
        }

        const { error } = await meuBanco.from('transacoes').insert(inserts);

        if (error) {
            alert('Erro ao salvar no banco de dados: ' + error.message);
        } else {
            formTransacao.reset();
            window.toggleParcelas();
            window.fecharModal();
            carregarDados();
        }
    });
}

// Puxar Dados do Banco
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
                <button onclick="deletarTransacao('${t.id}')" class="text-slate-300 hover:text-red-500 transition p-1">
                    <i class="ph-fill ph-trash text-lg"></i>
                </button>
            </div>
        `;
        lista.appendChild(item);
    });

    document.getElementById('totalGanhos').textContent = formatarDinheiro(totais.ganho);
    document.getElementById('totalDespesas').textContent = formatarDinheiro(totais.despesa);
    
    const saldo = totais.ganho - totais.despesa;
    document.getElementById('saldoTotal').textContent = formatarDinheiro(saldo);
}

// Deletar Transação Inteligente
window.deletarTransacao = async function(id) {
    if(!meuBanco) return;

    // Primeiro, descobre qual é a transação que você tá tentando apagar
    const { data: transacao } = await meuBanco.from('transacoes').select('*').eq('id', id).single();
    
    if(!transacao) return;

    if (transacao.categoria === 'fixo') {
        // Se for fixa, pergunta como apagar
        const resposta = prompt("Essa é uma transação FIXA. O que deseja fazer?\n\nDigite 1 = Apagar APENAS neste mês\nDigite 2 = Apagar neste e em TODOS os próximos\n\n(Deixe em branco para cancelar)");
        
        if (resposta === '1') {
            await meuBanco.from('transacoes').delete().eq('id', id);
        } else if (resposta === '2') {
            // Apaga essa e todas pra frente que tenham o mesmo nome
            await meuBanco.from('transacoes')
                .delete()
                .eq('categoria', 'fixo')
                .eq('descricao', transacao.descricao)
                .gte('data', transacao.data);
        } else {
            return; // Cancelou
        }
    } else {
        // Se for variável ou cartão, apaga normal
        if(confirm('Apagar essa transação?')) {
            await meuBanco.from('transacoes').delete().eq('id', id);
        }
    }
    
    carregarDados();
}

// Start
carregarDados();
