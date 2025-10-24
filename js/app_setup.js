/* ==================================================================
PROTÓTIPO HÍBRIDO EletroIA-MVP - PARTE 1: SETUP
Versão: FINAL COMPLETA e CORRIGIDA (Vendedores Atualizados) - 24/10/2025
==================================================================
*/

/* ==================================================================
!!! CREDENCIAIS REAIS INSERIDAS !!!
==================================================================
*/
const firebaseConfig = {
  apiKey: "AIzaSyB6mJ6Rpkb7toXJmG3fEHejC8Xctn6D8wg",
  authDomain: "eletroia-distribuidora.firebaseapp.com",
  databaseURL: "https://eletroia-distribuidora-default-rtdb.firebaseio.com",
  projectId: "eletroia-distribuidora",
  storageBucket: "eletroia-distribuidora.appspot.com",
  messagingSenderId: "579178573325",
  appId: "1:579178573325:web:b1b2295f9dbb0aa2252f44"
};

const CLOUDINARY_CLOUD_NAME = "dpaayfwlj";
const CLOUDINARY_UPLOAD_PRESET = "eletroia_unsigned";

// !!! ATENÇÃO: INSEGURANÇA !!!
// SUBSTITUA A LINHA ABAIXO PELA SUA CHAVE REAL DA API DO GEMINI (Google AI Studio)
const GEMINI_API_KEY = "COLE_SUA_GEMINI_API_KEY_AQUI"; // <<<<<<<<<<<<<<< SUBSTITUA AQUI
// -----------------------------------------------------------------------------
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
/* ==================================================================
FIM DA SEÇÃO DE CREDENCIAIS
==================================================================
*/

/* ==================================================================
SISTEMA DE NOTIFICAÇÕES
==================================================================
*/
function showNotification(message, type = 'success') {
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => notif.remove());
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `notification ${type}`;
  notification.textContent = message;
  const container = document.getElementById('notification-container'); // Usa o container dedicado
  if (container) {
    container.appendChild(notification);
    void notification.offsetWidth;
    notification.classList.add('show');
    setTimeout(() => {
      notification.classList.remove('show');
      notification.addEventListener('transitionend', () => {
        if (container.contains(notification)) container.removeChild(notification);
      }, { once: true });
    }, 4000);
  } else { console.error("Container de notificações não encontrado."); }
}

/* ==================================================================
UPLOAD DE ARQUIVOS
==================================================================
*/
const uploadFileToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  try {
    showNotification(`Enviando ${file.name}...`, 'warning');
    const response = await fetch(apiUrl, { method: 'POST', body: formData });
    if (!response.ok) {
       const errorData = await response.json(); console.error("Erro Cloudinary:", errorData);
       throw new Error(errorData.error?.message || `Falha no upload (${response.status})`);
    }
    const data = await response.json();
    showNotification(`'${file.name}' enviado!`, 'success');
    return data.secure_url; // Retorna a URL segura da imagem/arquivo
  } catch (error) {
    console.error("Erro no upload Cloudinary:", error);
    showNotification(`Erro upload ${file.name}: ${error.message}`, 'error');
    throw error; // Re-lança o erro para ser tratado no saveLogAndUploads
  }
};

/* ==================================================================
INICIALIZAÇÃO DO SISTEMA E ESTADO GLOBAL
==================================================================
*/
// Estado
let currentUser = null, allPedidos = {}, configData = { produtos: [] }, vendedores = [];
let lightboxMedia = [], currentLightboxIndex = 0, filesToUpload = [], initialDataLoaded = false;
let itensAdicionadosState = [];
let isMyAgendaViewActive = false;
let listenersAttached = false; // Flag para garantir que listeners sejam anexados só uma vez

// Constantes
const FORMAS_PAGAMENTO = ['PIX', 'Boleto', 'Cartão de Crédito', 'Dinheiro', 'Transferência'];
const STATUS_LIST = ['Novos-Leads', 'Em-Negociacao', 'Aguardando-Pagamento', 'Entregue'];
const CROSS_SELL_RULES = {
    "Disjuntor Steck": ["Caixa de Passagem Steck", "Fita Isolante"],
    "Cabo Flexível": ["Eletroduto Corrugado", "Conector Wago"],
    "Tomada Dupla": ["Placa 4x2", "Interruptor Simples"]
};
const FREQUENCY_ALERT_DAYS = 45;

// Seletores DOM (Cache)
const userScreen = document.getElementById('userScreen'), app = document.getElementById('app'), userList = document.getElementById('userList'),
      vendedorDashboard = document.getElementById('vendedorDashboard'), addPedidoBtn = document.getElementById('addPedidoBtn'),
      logoutButton = document.getElementById('logoutButton'), pedidoModal = document.getElementById('pedidoModal'),
      pedidoForm = document.getElementById('pedidoForm'), detailsModal = document.getElementById('detailsModal'),
      deleteBtn = document.getElementById('deleteBtn'), configBtn = document.getElementById('configBtn'),
      configModal = document.getElementById('configModal'), logForm = document.getElementById('logForm'),
      lightbox = document.getElementById('lightbox'), mediaInput = document.getElementById('media-input'),
      globalSearchInput = document.getElementById('globalSearchInput'), globalSearchResults = document.getElementById('globalSearchResults'),
      confirmDeleteModal = document.getElementById('confirmDeleteModal'), confirmDeleteBtn = document.getElementById('confirmDeleteBtn'),
      cancelDeleteBtn = document.getElementById('cancelDeleteBtn'), confirmDeleteText = document.getElementById('confirmDeleteText'),
      openCameraBtn = document.getElementById('openCameraBtn'), openGalleryBtn = document.getElementById('openGalleryBtn'),
      fileNameDisplay = document.getElementById('fileName'), lightboxClose = document.getElementById('lightbox-close'),
      toggleAgendaBtn = document.getElementById('toggleAgendaBtn'), dashboardNav = document.getElementById('dashboard-nav'),
      dashboardTitle = document.getElementById('dashboard-title');

// Funções Utilitárias
const formatCurrency = (value) => `R$ ${parseFloat(value || 0).toFixed(2).replace('.', ',')}`;
const formatStatus = (status) => status ? status.replace(/-/g, ' ') : 'Status Inválido';
const formatDate = (isoString) => isoString ? new Date(isoString).toLocaleDateString('pt-BR') : 'Data Inválida';
const formatDateTime = (isoString) => isoString ? new Date(isoString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'Data/Hora Inválida';

// --- Inicialização do Firebase ---
let db;
try {
    if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); console.log("Firebase inicializado."); }
    else { firebase.app(); console.log("Firebase já inicializado."); }
    db = firebase.database();
} catch(e) { console.error("Erro CRÍTICO Firebase:", e); setTimeout(() => showNotification("Erro crítico: Falha Firebase.", "error"), 500); throw new Error("Falha Firebase."); }

/* ==================================================================
LÓGICA DE LOGIN E AUTENTICAÇÃO
==================================================================
*/
const loadVendedores = async () => {
     try {
        if (!db) throw new Error("DB Firebase não disponível.");
        const snapshot = await db.ref('vendedores').once('value');
        const vendedoresData = snapshot.val();
        // Tenta carregar do Firebase
        if (vendedoresData && typeof vendedoresData === 'object' && Object.keys(vendedoresData).length > 0) {
            vendedores = Object.entries(vendedoresData).map(([key, value]) => ({ id: key, name: value.name || key, role: value.role || 'Vendedor' }));
            console.log("Vendedores carregados do Firebase:", vendedores);
        } else {
             // Se Firebase vazio/erro, usa a lista fixa ATUALIZADA
             console.warn("Nenhum vendedor no Firebase ou formato inválido. Usando fallback.");
             vendedores = [
                 { name: 'Thiago Ventura Valêncio', role: 'Vendedor' }, // ATUALIZADO
                 { name: 'Mauro Andrigo', role: 'Vendedor' },            // ATUALIZADO
                 { name: 'Raul Scremin', role: 'Gestor' },              // ATUALIZADO
                 { name: 'Guilherme Scremin', role: 'Gestor' }          // ATUALIZADO
                ];
             console.log("Usando vendedores do fallback:", vendedores);
        }
         // Validação final
         if(vendedores.length === 0){
             console.error("CRÍTICO: Lista de vendedores vazia após fallback.");
             showNotification("Erro: Vendedores não configurados.", "error");
        }
     } catch (error) {
        console.error("Erro ao carregar vendedores:", error);
        showNotification("Erro ao carregar vendedores.", "error");
        vendedores = []; // Garante que a lista esteja vazia em caso de erro grave
    }
};

const loginUser = async (user) => {
    if (!user?.name) { console.error("Login inválido:", user); return; }
    currentUser = user; localStorage.setItem('eletroIAUser', JSON.stringify(user));
    const userNameDisplay = document.getElementById('currentUserName'); if(userNameDisplay) userNameDisplay.textContent = user.name;
    const isGestor = user.role?.toLowerCase().includes('gestor');
    if(configBtn) configBtn.classList.toggle('hidden', !isGestor);
    const tabBtnGerencial = document.getElementById('tab-btn-gerencial'); if(tabBtnGerencial) tabBtnGerencial.classList.toggle('hidden', !isGestor);
    if(dashboardNav) dashboardNav.classList.remove('hidden');
    if(userScreen) userScreen.classList.add('hidden'); if(app) app.classList.remove('hidden');
    if(vendedorDashboard) vendedorDashboard.innerHTML = '<p class="text-center tc my-10 animate-pulse">Carregando...</p>';

    await loadConfig();
    initializeDashboard(); // Prepara a estrutura do dashboard
    listenToPedidos(); // Inicia o carregamento e monitoramento dos pedidos

    // A chamada setupEventListeners() está agora na função startApp()

    if (isGestor && typeof renderDashboardGerencial === 'function') {
         renderDashboardGerencial(); // Mostra painel gerencial se for gestor
    } else if (typeof switchDashboardTab === 'function') {
        switchDashboardTab('vendas'); // Garante que a aba de vendas esteja ativa
    }
};

const checkLoggedInUser = async () => {
    // Esta função é 'async' pois depende de 'loadVendedores'
    await loadVendedores();
    const storedUser = localStorage.getItem('eletroIAUser');
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            // Verifica se o usuário salvo AINDA EXISTE na lista carregada (Firebase ou fallback)
            if(vendedores.some(v => v.name === parsedUser.name)){
                loginUser(parsedUser); // Usuário já logado, entra direto
            } else {
                console.warn("Usuário salvo inválido ou não existe mais na lista atual.");
                localStorage.removeItem('eletroIAUser');
                displayLoginScreen(); // Usuário salvo não existe mais, mostra login
            }
        } catch(e) {
            console.error("Erro ao processar usuário salvo:", e);
            localStorage.removeItem('eletroIAUser');
            displayLoginScreen(); // Erro, mostra login
        }
    } else {
        displayLoginScreen(); // Nenhum usuário salvo, mostra login
    }
};

const displayLoginScreen = () => {
     if(userScreen) userScreen.classList.remove('hidden'); if(app) app.classList.add('hidden');
     if (userList) {
         if(vendedores.length > 0){
            // Gera os botões de usuário na tela de login
            userList.innerHTML = vendedores.map(user =>
                `<div class="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-100 hover:shadow-md cursor-pointer shadow-sm transition-all user-btn" data-user='${JSON.stringify(user).replace(/'/g, "&apos;")}'>
                  <p class="font-semibold text-gray-800 pointer-events-none">${user.name}</p>
                  <p class="text-sm text-gray-500 pointer-events-none">${user.role||'Vendedor'}</p>
                </div>`
            ).join('');
        } else {
            // Caso nenhum vendedor seja carregado (nem do Firebase, nem do fallback)
            userList.innerHTML = '<p class="text-red-500 text-sm col-span-full">Erro crítico: Nenhum vendedor encontrado.</p>';
        }
    } else {
        console.error("Elemento userList (para botões de login) não encontrado.");
        if(userScreen && !userScreen.classList.contains('hidden')) alert("Erro fatal: Interface de login incompleta.");
    }
};


/* ==================================================================
LÓGICA DO DASHBOARD E KANBAN
==================================================================
*/
const initializeDashboard = () => {
    if (!vendedorDashboard) { console.error("Elemento vendedorDashboard não encontrado."); return; }
    if (vendedores.length === 0) {
        vendedorDashboard.innerHTML = '<p class="text-center text-red-500 my-10">Erro: Vendedores não carregados.</p>';
        return;
    }
    vendedorDashboard.innerHTML = ''; // Limpa antes de recriar
    // Decide quais vendedores mostrar (todos ou apenas o logado)
    const vendedoresToShow = isMyAgendaViewActive ? vendedores.filter(v => v.name === currentUser.name) : vendedores;

    if (vendedoresToShow.length === 0 && isMyAgendaViewActive) {
         vendedorDashboard.innerHTML = '<p class="text-center text-gray-500 my-10">Nenhum pedido encontrado para você.</p>';
         if (dashboardTitle) dashboardTitle.textContent = `Minha Agenda - ${currentUser.name}`;
         return;
    }

    // Cria a seção e as colunas para cada vendedor a ser exibido
    vendedoresToShow.forEach(vendedor => {
        const vendedorSection = document.createElement('section');
        vendedorSection.className = 'vendedor-section';
        vendedorSection.id = `section-${vendedor.name.replace(/\s+/g, '-')}`;

        const header = document.createElement('h2');
        header.className = 'vendedor-header';
        header.textContent = vendedor.name;
        vendedorSection.appendChild(header);

        const kanbanContainer = document.createElement('div');
        kanbanContainer.className = 'kanban-container';

        // Cria as colunas de status
        STATUS_LIST.forEach(status => {
            const statusColumn = document.createElement('div');
            statusColumn.className = 'status-column';
            statusColumn.dataset.statusHeader = status;

            const statusHeader = document.createElement('h3');
            statusHeader.textContent = formatStatus(status);
            statusColumn.appendChild(statusHeader);

            const clientList = document.createElement('div');
            clientList.className = 'client-list';
            clientList.dataset.status = status;
            clientList.dataset.vendedor = vendedor.name; // Associa a lista ao vendedor
            clientList.innerHTML = '<p class="text-gray-400 text-xs italic p-4 tc">Carregando...</p>'; // Placeholder inicial
            statusColumn.appendChild(clientList);

            kanbanContainer.appendChild(statusColumn);
        });

        vendedorSection.appendChild(kanbanContainer);
        vendedorDashboard.appendChild(vendedorSection);
    });

    // Atualiza o título do dashboard
     if(dashboardTitle) dashboardTitle.textContent = isMyAgendaViewActive ? `Minha Agenda - ${currentUser.name}` : 'Visão Geral - Todos Vendedores';
};

const createCardHTML = (pedido) => {
    // Formata os dados para exibição no card
    const clienteDisplay = (pedido.clienteNome || 'Cliente Desc.').substring(0, 25);
    const dataDisplay = formatDateTime(pedido.createdAt || pedido.agendamento);
    const itensArray = Array.isArray(pedido.itens)?pedido.itens:[];
    const itensDisplay = itensArray.length > 0 ? itensArray.map(s => s.name).join(', ') : "S/ Itens";
    const valorDisplay = formatCurrency(pedido.valorTotal);
    const vendedorDisplay = pedido.vendedorResponsavel || 'N/A';

    // Lógica para botões de mover status
    const currentStatusIndex = STATUS_LIST.indexOf(pedido.status);
    const nextStatus = currentStatusIndex < STATUS_LIST.length - 1 ? STATUS_LIST[currentStatusIndex + 1] : null;
    const prevStatus = currentStatusIndex > 0 ? STATUS_LIST[currentStatusIndex - 1] : null;

    // Gera o HTML do card
    return `
    <div id="${pedido.id}" class="vehicle-card status-${pedido.status}" data-id="${pedido.id}">
        <div class="flex justify-between items-start">
            <div class="card-clickable-area cursor-pointer flex-grow space-y-1 pr-2 card-info overflow-hidden">
                <div class="flex justify-between items-baseline">
                    <p class="name truncate" title="${pedido.clienteNome||''}">${clienteDisplay}</p>
                    <p class="time flex-shrink-0 ml-2">${dataDisplay}</p>
                </div>
                <p class="text-sm truncate service text-gray-600" title="${itensDisplay}">${itensDisplay}</p>
                <div class="flex justify-between items-center mt-2 pt-1 border-t border-gray-100">
                    <p class="barber text-xs">${vendedorDisplay}</p>
                    <p class="price font-semibold">${valorDisplay}</p>
                </div>
            </div>
            <div class="flex flex-col items-center justify-center -mt-1 -mr-1 flex-shrink-0">
                <button data-id="${pedido.id}" data-new-status="${nextStatus}" class="btn-move-status p-1 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-100 ${!nextStatus?'invisible':''}" title="Avançar Status">
                    <i class='bx bx-chevron-right text-2xl'></i>
                </button>
                <button data-id="${pedido.id}" data-new-status="${prevStatus}" class="btn-move-status p-1 rounded-full text-gray-400 hover:text-orange-600 hover:bg-orange-100 ${!prevStatus?'invisible':''}" title="Retroceder Status">
                    <i class='bx bx-chevron-left text-2xl'></i>
                </button>
            </div>
        </div>
    </div>`;
};

 const renderCard = (pedido) => {
   // Validações básicas
   if (!pedido?.vendedorResponsavel || !pedido.status || !pedido.id) { console.warn("Dados inválidos para renderizar card:", pedido); return; }
   // Se a visão "Minha Agenda" está ativa, esconde cards de outros vendedores
   if (isMyAgendaViewActive && pedido.vendedorResponsavel !== currentUser.name) {
       const existingCardElement = document.getElementById(pedido.id);
       if (existingCardElement) existingCardElement.remove(); // Remove se já existia
       return; // Não renderiza
   }
   // Gera o HTML do card
   const cardHTML = createCardHTML(pedido);
   // Encontra a lista correta (coluna de status + vendedor)
   const listSelector = `#vendedorDashboard .client-list[data-vendedor="${pedido.vendedorResponsavel}"][data-status="${pedido.status}"]`;
   let targetList = document.querySelector(listSelector);
   // Fallback (caso a seção do vendedor não exista mais, raro)
   if (!targetList) {
       console.warn(`Lista específica ${listSelector} não encontrada. Tentando fallback geral para status ${pedido.status}.`);
       const fallbackListSelector = `#vendedorDashboard .client-list[data-status="${pedido.status}"]`;
       targetList = document.querySelector(fallbackListSelector);
   }
   // Remove card antigo se existir (para casos de mudança de status)
   const existingCardElement = document.getElementById(pedido.id);
   if (existingCardElement) { existingCardElement.remove(); }
   // Adiciona o novo card na lista correta
   if (targetList) {
       const placeholder = targetList.querySelector('p.text-gray-400'); // Remove placeholder "Carregando..." ou "Nenhum pedido."
       if (placeholder) placeholder.remove();
       targetList.insertAdjacentHTML('beforeend', cardHTML); // Adiciona no final da lista
   } else {
        console.error(`CRÍTICO: Lista de destino para status ${pedido.status} não encontrada. Card ${pedido.id} não pôde ser renderizado.`);
   }
 };

const toggleMyAgendaView = () => {
    isMyAgendaViewActive = !isMyAgendaViewActive; // Inverte o estado
    // Atualiza a aparência do botão
    if(toggleAgendaBtn) {
        toggleAgendaBtn.classList.toggle('bg-blue-100', isMyAgendaViewActive);
        toggleAgendaBtn.classList.toggle('text-blue-700', isMyAgendaViewActive);
        toggleAgendaBtn.classList.toggle('border-blue-300', isMyAgendaViewActive);
        toggleAgendaBtn.classList.toggle('bg-white', !isMyAgendaViewActive);
        toggleAgendaBtn.classList.toggle('text-gray-700', !isMyAgendaViewActive);
        toggleAgendaBtn.classList.toggle('border-gray-300', !isMyAgendaViewActive);
    }
    // Recria a estrutura do dashboard (mostrando todos ou só o atual)
    initializeDashboard();
    // Renderiza novamente todos os cards (a função renderCard vai filtrar se necessário)
    Object.values(allPedidos).forEach(renderCard);
    // Adiciona mensagem se listas ficarem vazias após filtrar
    if(vendedorDashboard){
        vendedorDashboard.querySelectorAll('.client-list').forEach(list => {
            if(list.children.length === 0){ // Se a lista não tem nenhum card
                 list.innerHTML = '<p class="tc text-gray-400 text-xs italic p-4">Nenhum pedido.</p>';
            }
        });
    }
};

/* ==================================================================
LISTENERS DO FIREBASE
==================================================================
*/
const listenToPedidos = () => {
    if (!db) { console.error("DB Firebase não inicializado."); return; }
    const ref = db.ref('pedidos'); // Referência para o nó 'pedidos'
    initialDataLoaded = false; // Reseta flag de carga inicial
    // Mostra indicador de carregamento no dashboard
    if (vendedorDashboard) {
        vendedorDashboard.querySelectorAll('.client-list').forEach(list => list.innerHTML = '<p class="tc text-gray-400 text-xs italic p-4 animate-pulse">Carregando...</p>');
    } else {
        console.error("Dashboard não encontrado para mostrar carregamento.");
        return; // Não continua sem o dashboard
    }
    allPedidos = {}; // Limpa o cache local de pedidos

    // 1. Carga Inicial (once)
    ref.once('value', snapshot => {
        allPedidos = snapshot.val() || {}; // Pega todos os pedidos ou um objeto vazio
        // Adiciona o ID do Firebase como propriedade de cada pedido
        Object.keys(allPedidos).forEach(key => { if(allPedidos[key]) allPedidos[key].id = key; });

        // Limpa os placeholders de carregamento
        if (vendedorDashboard) { vendedorDashboard.querySelectorAll('.client-list').forEach(list => list.innerHTML = ''); }

        // Renderiza todos os cards carregados
        Object.values(allPedidos).forEach(renderCard);

        // Adiciona placeholder se alguma lista ficou vazia após a carga
        if(vendedorDashboard){
            vendedorDashboard.querySelectorAll('.client-list').forEach(list => {
                if(list.children.length === 0){
                    list.innerHTML = '<p class="tc text-gray-400 text-xs italic p-4">Nenhum pedido.</p>';
                }
            });
        }
        initialDataLoaded = true; // Marca que a carga inicial terminou
        console.log(`Carga inicial concluída: ${Object.keys(allPedidos).length} pedidos.`);

        // Verifica se os listeners de clique já foram anexados
        if (listenersAttached) {
             console.log("Listeners de eventos (clique) já configurados pela inicialização.");
        } else {
             // Fallback: Tenta anexar agora se a inicialização falhou
             console.error("ERRO GRAVE: Listeners de clique não foram anexados na inicialização. Tentando anexar agora...");
             if (typeof setupEventListeners === 'function') {
                setupEventListeners();
                listenersAttached = true;
                console.log("Listeners de clique anexados como fallback.");
             } else {
                showNotification("Erro: Falha crítica ao carregar interações.", "error");
             }
        }

        // 2. Inicia Listeners em Tempo Real (on)
        startIndividualListeners(ref);

    }, error => {
        // Tratamento de erro na carga inicial
        console.error("Erro na carga inicial de pedidos do Firebase:", error);
        showNotification("Erro grave ao carregar dados. Verifique a conexão.", "error");
        if (vendedorDashboard) { vendedorDashboard.innerHTML = '<p class="tc text-red-500 my-10">Falha ao carregar dados.</p>'; }
    });
};

const startIndividualListeners = (ref) => {
    // Listener para NOVOS pedidos ('child_added')
    ref.on('child_added', snapshot => {
        if (!initialDataLoaded) return; // Ignora eventos durante a carga inicial
        const pedido = { ...snapshot.val(), id: snapshot.key };
        if (!allPedidos[pedido.id]) { // Confirma que realmente é novo
            console.log("Novo pedido detectado:", pedido.id);
            allPedidos[pedido.id] = pedido; // Adiciona ao cache local
            renderCard(pedido); // Renderiza o novo card
        }
    });

    // Listener para pedidos MODIFICADOS ('child_changed')
    ref.on('child_changed', snapshot => {
        if (!initialDataLoaded) return;
        const pedido = { ...snapshot.val(), id: snapshot.key };
        console.log("Pedido modificado detectado:", pedido.id);
        allPedidos[pedido.id] = pedido; // Atualiza o cache local
        renderCard(pedido); // Re-renderiza o card (que pode mudar de coluna/conteúdo)
        // Se o modal de detalhes estiver aberto para este pedido, atualiza-o também
        if (detailsModal && !detailsModal.classList.contains('hidden') && document.getElementById('logPedidoId')?.value === pedido.id) {
             console.log("Atualizando modal de detalhes aberto para", pedido.id);
             openDetailsModal(pedido.id); // Reabre/atualiza o modal
        }
        // Atualiza métricas gerenciais se a aba estiver ativa
        if(document.getElementById('gerencial-content') && !document.getElementById('gerencial-content').classList.contains('hidden') && typeof renderDashboardGerencial === 'function') {
            renderDashboardGerencial();
        }
    });

    // Listener para pedidos REMOVIDOS ('child_removed')
    ref.on('child_removed', snapshot => {
         if (!initialDataLoaded) return;
         const pedidoId = snapshot.key;
         console.log("Pedido removido detectado:", pedidoId);
         delete allPedidos[pedidoId]; // Remove do cache local
         // Remove o card da interface
         const cardElement = document.getElementById(pedidoId);
         if (cardElement) {
             const parentList = cardElement.parentElement;
             cardElement.remove();
             // Se a lista ficou vazia, adiciona placeholder
             if (parentList && parentList.children.length === 0) {
                 parentList.innerHTML = '<p class="tc text-gray-400 text-xs italic p-4">Nenhum pedido.</p>';
             }
         }
         // Se o modal de detalhes estava aberto para este pedido, fecha-o
        if (detailsModal && !detailsModal.classList.contains('hidden') && document.getElementById('logPedidoId')?.value === pedidoId) {
             detailsModal.classList.add('hidden');
             showNotification("O pedido que você estava vendo foi excluído.", "warning");
        }
        // Atualiza métricas gerenciais se a aba estiver ativa
        if(document.getElementById('gerencial-content') && !document.getElementById('gerencial-content').classList.contains('hidden') && typeof renderDashboardGerencial === 'function') {
            renderDashboardGerencial();
        }
    });
};

const loadConfig = async () => {
     try {
         if (!db) throw new Error("DB Firebase não disponível.");
         const snapshot = await db.ref('config').once('value');
         configData = snapshot.val() || { produtos: [] };
         // Garante que 'produtos' seja sempre um array
         if (configData.produtos && typeof configData.produtos === 'object' && !Array.isArray(configData.produtos)) {
             configData.produtos = Object.values(configData.produtos);
         } else if (!Array.isArray(configData.produtos)) {
             configData.produtos = [];
         }
         // Ordena os produtos alfabeticamente
         configData.produtos.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
         console.log("Config carregada:", configData.produtos.length, "produtos.");
    } catch (error) {
         console.error("Erro ao carregar configuração (produtos):", error);
         showNotification("Erro ao carregar lista de produtos.", "error");
         configData = { produtos: [] }; // Define como vazio em caso de erro
    }
};


/* ==================================================================
INICIALIZAÇÃO DA APLICAÇÃO (BLOCO CORRIGIDO FINAL + ROBUSTEZ)
==================================================================
*/

// Função unificada de inicialização
const startApp = async () => {
    console.log("Iniciando startApp...");
     try {
        // 1. ESPERA (await) a checagem de login terminar
        //    Isso garante que loadVendedores() e displayLoginScreen() já rodaram.
        await checkLoggedInUser();
        console.log("checkLoggedInUser concluído.");
     } catch (error) {
         console.error("Erro durante checkLoggedInUser:", error);
         showNotification("Erro crítico ao iniciar. Tente recarregar.", "error");
         return; // Interrompe se o login falhar criticamente
     }

     // 2. Tenta anexar os listeners. Adiciona espera se setupEventListeners não estiver pronta.
     const attachListeners = () => {
        if (typeof setupEventListeners === 'function') {
            setupEventListeners(); // Chama a função que está em app_logic.js
            listenersAttached = true; // Informa o 'listenToPedidos' que já foi executado.
            console.log("setupEventListeners chamado com sucesso.");
        } else {
            console.error("ERRO CRÍTICO: app_logic.js não carregou a função setupEventListeners.");
            showNotification("Erro: Falha ao carregar interações.", "error");
            // Tenta novamente após um pequeno delay como último recurso
            // setTimeout(() => {
            //     if (typeof setupEventListeners === 'function') {
            //         console.log("Tentando setupEventListeners após delay...");
            //         setupEventListeners();
            //         listenersAttached = true;
            //     } else {
            //          console.error("setupEventListeners ainda não disponível após delay.");
            //     }
            // }, 500); // Espera 500ms
        }
     }

     attachListeners(); // Tenta anexar imediatamente
     console.log("startApp finalizado.");
};

// Garante que o DOM esteja pronto ANTES de tentar configurar listeners ou checar login
if (document.readyState === 'loading') {
    console.log("DOM loading, aguardando DOMContentLoaded...");
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    // DOM já pronto, chama a inicialização
    console.log("DOM pronto, chamando startApp diretamente.");
    startApp();
}

// --- FIM app_setup.js ---

