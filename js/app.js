/* ==================================================================
PROTÓTIPO HÍBRIDO EletroIA-MVP
Motor:
- Arquitetura de UI Multi-Vendedor (Base: Habibi)
- Fluxo de Pedidos e Mídia (Base: Chevron)
- Lógica de Produtos (Base: Habibi/Techmess)
Versão: Completa e Corrigida (ReferenceError Fix) - 23/10/2025
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
  storageBucket: "eletroia-distribuidora.appspot.com", // Verifique se é .appspot.com ou .firebasestorage.app no seu console
  messagingSenderId: "579178573325",
  appId: "1:579178573325:web:b1b2295f9dbb0aa2252f44"
};

const CLOUDINARY_CLOUD_NAME = "dpaayfwlj";
const CLOUDINARY_UPLOAD_PRESET = "eletroia_unsigned";
/* ==================================================================
FIM DA SEÇÃO DE CREDENCIAIS
==================================================================
*/


/* ==================================================================
SISTEMA DE NOTIFICAÇÕES (Base Chevron)
==================================================================
*/
function showNotification(message, type = 'success') {
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => notif.remove());

  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = `notification ${type}`;
  notification.textContent = message;
  // Garante que o elemento exista antes de adicionar
  if (document.body) {
      document.body.appendChild(notification);
      void notification.offsetWidth; // Força reflow
      notification.classList.add('show');

      setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, { once: true });
      }, 4000);
  } else {
      console.error("document.body não encontrado para exibir notificação.");
  }
}


/* ==================================================================
UPLOAD DE ARQUIVOS (Base Chevron)
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
       const errorData = await response.json();
       console.error("Erro Cloudinary:", errorData);
       throw new Error(errorData.error?.message || `Falha no upload (${response.status})`);
    }
    const data = await response.json();
     showNotification(`'${file.name}' enviado com sucesso!`, 'success');
    return data.secure_url;

  } catch (error) {
    console.error("Erro no upload para o Cloudinary:", error);
    showNotification(`Erro no upload de ${file.name}: ${error.message}`, 'error');
    throw error;
  }
};

/* ==================================================================
INICIALIZAÇÃO DO SISTEMA E ESTADO GLOBAL
==================================================================
*/
// Estado
let currentUser = null;
let allPedidos = {};
let configData = { produtos: [] };
let vendedores = [];
let lightboxMedia = [];
let currentLightboxIndex = 0;
let filesToUpload = [];
let initialDataLoaded = false;

// Constantes
const FORMAS_PAGAMENTO = ['PIX', 'Boleto', 'Cartão de Crédito', 'Dinheiro', 'Transferência'];
const STATUS_LIST = ['Novos-Leads', 'Em-Negociacao', 'Aguardando-Pagamento', 'Entregue'];

// Seletores DOM (Cache de elementos para performance)
const userScreen = document.getElementById('userScreen');
const app = document.getElementById('app');
const userList = document.getElementById('userList');
const vendedorDashboard = document.getElementById('vendedorDashboard');
const addPedidoBtn = document.getElementById('addPedidoBtn');
const logoutButton = document.getElementById('logoutButton');
const pedidoModal = document.getElementById('pedidoModal');
const pedidoForm = document.getElementById('pedidoForm');
const detailsModal = document.getElementById('detailsModal');
const deleteBtn = document.getElementById('deleteBtn');
const configBtn = document.getElementById('configBtn');
const configModal = document.getElementById('configModal');
const logForm = document.getElementById('logForm');
const lightbox = document.getElementById('lightbox');
const mediaInput = document.getElementById('media-input');
const globalSearchInput = document.getElementById('globalSearchInput');
const globalSearchResults = document.getElementById('globalSearchResults');
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteText = document.getElementById('confirmDeleteText');
const openCameraBtn = document.getElementById('openCameraBtn');
const openGalleryBtn = document.getElementById('openGalleryBtn');
const fileNameDisplay = document.getElementById('fileName');
const lightboxClose = document.getElementById('lightbox-close');

// Funções Utilitárias
const formatCurrency = (value) => `R$ ${parseFloat(value || 0).toFixed(2).replace('.', ',')}`;
const formatStatus = (status) => status ? status.replace(/-/g, ' ') : 'Status Inválido';
const formatDate = (isoString) => isoString ? new Date(isoString).toLocaleDateString('pt-BR') : 'Data Inválida';
const formatDateTime = (isoString) => isoString ? new Date(isoString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'Data/Hora Inválida';

// --- Inicialização do Firebase ---
let db; // Declara db no escopo global
try {
    if (!firebase.apps.length) {
       firebase.initializeApp(firebaseConfig);
       console.log("Firebase inicializado com sucesso.");
    } else {
       firebase.app();
       console.log("Firebase já estava inicializado.");
    }
    db = firebase.database(); // Atribui a referência do DB à variável global
} catch(e) {
    console.error("Erro CRÍTICO ao inicializar Firebase:", e);
    setTimeout(() => showNotification("Erro crítico: Falha ao conectar. Verifique console e credenciais.", "error"), 500);
    // Impede a execução do resto do script se o Firebase falhar
    throw new Error("Falha na inicialização do Firebase.");
}

/* ==================================================================
LÓGICA DE LOGIN E AUTENTICAÇÃO
==================================================================
*/
const loadVendedores = async () => {
     // Código completo da função loadVendedores
     try {
        if (!db) throw new Error("Referência do DB Firebase não está disponível.");
        const snapshot = await db.ref('vendedores').once('value');
        const vendedoresData = snapshot.val();
        if (vendedoresData && typeof vendedoresData === 'object') {
            vendedores = Object.entries(vendedoresData).map(([key, value]) => ({
                id: key,
                name: value.name || key,
                role: value.role || 'Vendedor'
            }));
             console.log("Vendedores carregados do Firebase:", vendedores);
        } else {
             console.warn("Nenhum vendedor encontrado ou formato inválido no Firebase. Usando lista simulada.");
             vendedores = [
                { name: 'Mauro Andrigo', role: 'Vendedor 1' },
                { name: 'Thiago Ventura Valencio ', role: 'Vendedor 2' },
                { name: 'Guilherme', role: 'Gestor' }
             ];
             // Opcional: Salvar a lista simulada se o nó 'vendedores' não existir
             // await db.ref('vendedores').set(vendedores.reduce((obj, v) => { obj[v.name] = { name: v.name, role: v.role }; return obj; }, {}));
        }
         if(vendedores.length === 0){
              console.error("CRÍTICO: Nenhuma lista de vendedores disponível.");
              showNotification("Erro: Lista de vendedores vazia.", "error");
         }
     } catch (error) {
         console.error("Erro ao carregar vendedores:", error);
         showNotification("Erro ao carregar lista de vendedores.", "error");
         vendedores = []; // Define como vazio em caso de erro grave
     }
};

const loginUser = async (user) => {
    // Código completo da função loginUser
    if (!user || !user.name) {
        console.error("Tentativa de login com usuário inválido:", user);
        showNotification("Erro: Usuário inválido.", "error");
        return;
    }
    currentUser = user;
    localStorage.setItem('eletroIAUser', JSON.stringify(user));
    const userNameDisplay = document.getElementById('currentUserName');
    if(userNameDisplay) userNameDisplay.textContent = user.name;

    if(configBtn) configBtn.classList.toggle('hidden', !(user.role && user.role.toLowerCase().includes('gestor')));

    if(userScreen) userScreen.classList.add('hidden');
    if(app) app.classList.remove('hidden');

    if(vendedorDashboard) vendedorDashboard.innerHTML = '<p class="text-center text-gray-500 my-10 animate-pulse">Carregando dados...</p>';

    await loadConfig();
    initializeDashboard();
    listenToPedidos();
};

const checkLoggedInUser = async () => {
    // Código completo da função checkLoggedInUser
    await loadVendedores(); // Carrega vendedores PRIMEIRO
    const storedUser = localStorage.getItem('eletroIAUser');
    if (storedUser) {
        try {
           const parsedUser = JSON.parse(storedUser);
           if(vendedores.some(v => v.name === parsedUser.name)){
               loginUser(parsedUser);
           } else {
                console.warn("Usuário salvo não encontrado na lista atual. Forçando logout.");
                localStorage.removeItem('eletroIAUser');
                displayLoginScreen();
           }
        } catch(e) {
             console.error("Erro ao parsear usuário salvo:", e);
             localStorage.removeItem('eletroIAUser');
             displayLoginScreen();
        }
    } else {
       displayLoginScreen();
    }
};

const displayLoginScreen = () => {
    // Código completo da função displayLoginScreen
     if(userScreen) userScreen.classList.remove('hidden');
     if(app) app.classList.add('hidden');
     if (userList) {
        if(vendedores.length > 0){
            userList.innerHTML = vendedores.map(user =>
                `<div class="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-100 hover:shadow-md cursor-pointer shadow-sm transition-all user-btn" data-user='${JSON.stringify(user).replace(/'/g, "&apos;")}'>
                  <p class="font-semibold text-gray-800 pointer-events-none">${user.name}</p>
                  <p class="text-sm text-gray-500 pointer-events-none">${user.role || 'Vendedor'}</p>
                </div>`
              ).join('');
        } else {
             userList.innerHTML = '<p class="text-red-500 text-sm col-span-full">Erro: Nenhum vendedor configurado. Contacte o administrador.</p>';
        }
     } else {
          console.error("Elemento userList não encontrado.");
          if(userScreen && !userScreen.classList.contains('hidden')) { // Mostra alerta só se a tela de login estiver visível
             alert("Erro crítico: Interface de login não carregou corretamente.");
          }
     }
};


/* ==================================================================
LÓGICA DO DASHBOARD
==================================================================
*/
const initializeDashboard = () => {
    // Código completo da função initializeDashboard
    if (!vendedorDashboard) { console.error("Elemento vendedorDashboard não encontrado."); showNotification("Erro ao carregar interface.", "error"); return; }
    if (vendedores.length === 0) { vendedorDashboard.innerHTML = '<p class="text-center text-red-500 my-10">Erro: Vendedores não carregados.</p>'; return; }

    vendedorDashboard.innerHTML = ''; // Limpa antes de recriar
    vendedores.forEach(vendedor => {
        const vendedorSection = document.createElement('section');
        vendedorSection.className = 'vendedor-section';
        vendedorSection.id = `section-${vendedor.name.replace(/\s+/g, '-')}`;
        const header = document.createElement('h2');
        header.className = 'vendedor-header';
        header.textContent = vendedor.name;
        vendedorSection.appendChild(header);
        const kanbanContainer = document.createElement('div');
        kanbanContainer.className = 'kanban-container';
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
            clientList.dataset.vendedor = vendedor.name;
            clientList.innerHTML = '<p class="text-center text-gray-400 text-xs italic p-4">Carregando...</p>'; // Placeholder
            statusColumn.appendChild(clientList);
            kanbanContainer.appendChild(statusColumn);
        });
        vendedorSection.appendChild(kanbanContainer);
        vendedorDashboard.appendChild(vendedorSection);
    });
};

const createCardHTML = (pedido) => {
    // Código completo da função createCardHTML
    const clienteDisplay = (pedido.clienteNome || 'Cliente Desconhecido').substring(0, 25);
    const dataDisplay = formatDateTime(pedido.createdAt || pedido.agendamento);
    const itensArray = Array.isArray(pedido.itens) ? pedido.itens : [];
    const itensDisplay = itensArray.length > 0 ? itensArray.map(s => s.name).join(', ') : "Nenhum item";
    const valorDisplay = formatCurrency(pedido.valorTotal);
    const vendedorDisplay = pedido.vendedorResponsavel || 'N/A';
    const currentStatusIndex = STATUS_LIST.indexOf(pedido.status);
    const nextStatus = currentStatusIndex < STATUS_LIST.length - 1 ? STATUS_LIST[currentStatusIndex + 1] : null;
    const prevStatus = currentStatusIndex > 0 ? STATUS_LIST[currentStatusIndex - 1] : null;

    return `
      <div id="${pedido.id}" class="vehicle-card status-${pedido.status}" data-id="${pedido.id}">
        <div class="flex justify-between items-start">
            <div class="card-clickable-area cursor-pointer flex-grow space-y-1 pr-2 card-info overflow-hidden">
              <div class="flex justify-between items-baseline">
                <p class="name truncate" title="${pedido.clienteNome || ''}">${clienteDisplay}</p>
                <p class="time flex-shrink-0 ml-2">${dataDisplay}</p>
              </div>
              <p class="text-sm truncate service text-gray-600" title="${itensDisplay}">${itensDisplay}</p>
              <div class="flex justify-between items-center mt-2 pt-1 border-t border-gray-100">
                 <p class="barber text-xs">${vendedorDisplay}</p>
                 <p class="price font-semibold">${valorDisplay}</p>
              </div>
            </div>
            <div class="flex flex-col items-center justify-center -mt-1 -mr-1 flex-shrink-0">
                <button data-id="${pedido.id}" data-new-status="${nextStatus}" class="btn-move-status p-1 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-100 ${!nextStatus ? 'invisible' : ''}" title="Avançar Status"><i class='bx bx-chevron-right text-2xl'></i></button>
                <button data-id="${pedido.id}" data-new-status="${prevStatus}" class="btn-move-status p-1 rounded-full text-gray-400 hover:text-orange-600 hover:bg-orange-100 ${!prevStatus ? 'invisible' : ''}" title="Retroceder Status"><i class='bx bx-chevron-left text-2xl'></i></button>
            </div>
        </div>
      </div>`;
};

 const renderCard = (pedido) => {
   // Código completo da função renderCard
   if (!pedido || !pedido.vendedorResponsavel || !pedido.status || !pedido.id) {
      console.warn("Tentativa de renderizar card inválido:", pedido);
      return;
   }
   const cardHTML = createCardHTML(pedido);
   const listSelector = `#vendedorDashboard .client-list[data-vendedor="${pedido.vendedorResponsavel}"][data-status="${pedido.status}"]`;
   let list = document.querySelector(listSelector);

    if (!list) {
         console.warn(`Lista não encontrada para ${pedido.vendedorResponsavel} / ${pedido.status}. Tentando fallback geral.`);
         const fallbackListSelector = `#vendedorDashboard .client-list[data-status="${pedido.status}"]`;
         list = document.querySelector(fallbackListSelector);
    }

   const existingCard = document.getElementById(pedido.id);
   if (existingCard) {
       existingCard.remove();
   }

   if (list) {
        const placeholder = list.querySelector('p.text-gray-400');
        if (placeholder) placeholder.remove();

       list.insertAdjacentHTML('beforeend', cardHTML);
   } else {
       console.error(`Falha Crítica: Nenhuma lista encontrada para o status ${pedido.status}. Card ${pedido.id} não exibido.`);
   }
 };

/* ==================================================================
LISTENERS DO FIREBASE
==================================================================
*/
const listenToPedidos = () => {
    // Código completo da função listenToPedidos
    if (!db) { console.error("DB Firebase não inicializado. Abortando listenToPedidos."); return; }
    const ref = db.ref('pedidos');
    initialDataLoaded = false;

    if (vendedorDashboard) {
        vendedorDashboard.querySelectorAll('.client-list').forEach(list => list.innerHTML = '<p class="text-center text-gray-400 text-xs italic p-4 animate-pulse">Carregando...</p>');
    } else { console.error("Dashboard não encontrado ao iniciar listeners."); return; }
    allPedidos = {};

    ref.once('value', snapshot => {
        allPedidos = snapshot.val() || {};
         Object.keys(allPedidos).forEach(key => {
             if(allPedidos[key]) allPedidos[key].id = key;
         });

         if (vendedorDashboard) {
            vendedorDashboard.querySelectorAll('.client-list').forEach(list => list.innerHTML = ''); // Limpa placeholders
         }

        Object.values(allPedidos).forEach(renderCard); // Renderiza todos

        if(vendedorDashboard){ // Adiciona placeholder às listas vazias
            vendedorDashboard.querySelectorAll('.client-list').forEach(list => {
                if(list.children.length === 0){
                   list.innerHTML = '<p class="text-center text-gray-400 text-xs italic p-4">Nenhum pedido neste status.</p>';
                }
            });
        }

        initialDataLoaded = true;
        console.log(`Carga inicial: ${Object.keys(allPedidos).length} pedidos.`);
        // showNotification("Pedidos carregados.", "success"); // Opcional

        startIndividualListeners(ref); // Inicia listeners individuais

    }, error => {
        console.error("Erro na carga inicial (Firebase 'value'):", error);
        showNotification("Erro grave ao carregar dados. Verifique console e conexão.", "error");
         if (vendedorDashboard) {
            vendedorDashboard.innerHTML = '<p class="text-center text-red-500 my-10">Falha ao carregar dados. Tente recarregar.</p>';
         }
    });
};

const startIndividualListeners = (ref) => {
    // Código completo da função startIndividualListeners
    // Novo pedido
    ref.orderByChild('createdAt').startAt(Date.now()).on('child_added', snapshot => { // Ouve apenas novos a partir de agora
    // Removendo startAt para simplicidade no protótipo:
    // ref.on('child_added', snapshot => { // Ouvir todos os 'child_added'
        if (!initialDataLoaded) return; // Ignora durante carga inicial

        const pedido = { ...snapshot.val(), id: snapshot.key };
        if (!allPedidos[pedido.id]) { // Adiciona apenas se realmente novo
            console.log("Listener 'child_added' detectou novo pedido:", pedido.id);
            allPedidos[pedido.id] = pedido;
            renderCard(pedido);
        } else {
             // console.log("Listener 'child_added' ignorou pedido já carregado:", pedido.id);
        }
    });

    // Pedido modificado
    ref.on('child_changed', snapshot => {
        if (!initialDataLoaded) return; // Espera carga inicial
        const pedido = { ...snapshot.val(), id: snapshot.key };
        console.log("Listener 'child_changed' detectou:", pedido.id);
        allPedidos[pedido.id] = pedido; // Atualiza cache
        renderCard(pedido); // Re-renderiza

        if (detailsModal && !detailsModal.classList.contains('hidden') && document.getElementById('logPedidoId')?.value === pedido.id) {
            openDetailsModal(pedido.id); // Atualiza modal
        }
    });

    // Pedido removido
    ref.on('child_removed', snapshot => {
         if (!initialDataLoaded) return; // Espera carga inicial
        const pedidoId = snapshot.key;
        console.log("Listener 'child_removed' detectou:", pedidoId);
        delete allPedidos[pedidoId]; // Remove do cache
        const card = document.getElementById(pedidoId);
        if (card) {
            const list = card.parentElement;
            card.remove(); // Remove da UI
             if (list && list.children.length === 0) { // Adiciona placeholder se lista ficou vazia
                list.innerHTML = '<p class="text-center text-gray-400 text-xs italic p-4">Nenhum pedido neste status.</p>';
             }
        }

        if (detailsModal && !detailsModal.classList.contains('hidden') && document.getElementById('logPedidoId')?.value === pedidoId) {
             detailsModal.classList.add('hidden');
              showNotification("O pedido que estava aberto foi excluído.", "warning");
        }
    });
};

const loadConfig = async () => {
    // Código completo da função loadConfig
     try {
        if (!db) throw new Error("Referência do DB Firebase não disponível.");
        const snapshot = await db.ref('config').once('value');
        configData = snapshot.val() || { produtos: [] };
        if (configData.produtos && typeof configData.produtos === 'object' && !Array.isArray(configData.produtos)) {
            configData.produtos = Object.values(configData.produtos);
        } else if (!Array.isArray(configData.produtos)) {
             configData.produtos = [];
        }
         // Ordena os produtos alfabeticamente após carregar
         configData.produtos.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
         console.log("Configuração (produtos) carregada:", configData.produtos.length, "itens.");
    } catch (error) {
        console.error("Erro ao carregar configuração /config:", error);
        showNotification("Erro ao carregar a lista de produtos.", "error");
        configData = { produtos: [] };
    }
};


/* ==================================================================
FUNÇÕES DE MANIPULAÇÃO DE PEDIDOS
==================================================================
*/
const updatePedidoStatus = async (id, newStatus) => {
    // Código completo da função updatePedidoStatus
    const pedido = allPedidos[id];
    if (!pedido) { showNotification("Erro: Pedido não encontrado.", "error"); return; }
    if (!newStatus || !STATUS_LIST.includes(newStatus)) { showNotification(`Erro: Status "${newStatus || 'vazio'}" inválido.`, "error"); return; }
    if (pedido.status === newStatus) return;

    const oldStatus = pedido.status;
    const logEntry = {
        timestamp: new Date().toISOString(), user: currentUser.name,
        description: `Status alterado de "${formatStatus(oldStatus)}" para "${formatStatus(newStatus)}".`,
        type: 'status'
    };
    try {
         await db.ref(`pedidos/${id}/logs`).push(logEntry);
         await db.ref(`pedidos/${id}`).update({ status: newStatus, lastUpdate: new Date().toISOString() });
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        showNotification("Falha ao mover pedido.", "error");
    }
};

const saveNewPedido = async (e) => {
    // Código completo da função saveNewPedido
    e.preventDefault();
    const clienteNomeInput = document.getElementById('clienteNome');
    const vendedorSelect = document.getElementById('vendedorResponsavel');
    const observacoesInput = document.getElementById('pedidoObservacoes');
    const formButton = pedidoForm ? pedidoForm.querySelector('button[type="submit"]') : null;

    if(formButton) formButton.disabled = true; // Desabilita botão

    const clienteNome = clienteNomeInput ? clienteNomeInput.value.trim() : '';
    const vendedorResponsavel = vendedorSelect ? vendedorSelect.value : '';
    const observacoes = observacoesInput ? observacoesInput.value.trim() : '';

    if (!clienteNome || !vendedorResponsavel) {
         showNotification("Cliente e Vendedor são obrigatórios.", "error");
         if(formButton) formButton.disabled = false; return; // Reabilita e sai
    }

    const selectedItensCheckboxes = Array.from(document.querySelectorAll('#servicosList input:checked'));
    const itens = selectedItensCheckboxes.map(input => ({ name: input.dataset.name, price: parseFloat(input.value) || 0 }));
    const valorTotalInicial = itens.reduce((sum, item) => sum + item.price, 0);

    let pedidoNumero = 1000; // Default
    try {
         const configRef = db.ref('config/proximoPedido');
         const { committed, snapshot } = await configRef.transaction(currentValue => (currentValue || 1000) + 1);
         if (committed && snapshot.val()) { pedidoNumero = snapshot.val(); }
         else { throw new Error("Falha na transação do número."); }
    } catch (error) {
         console.error("Erro ao gerar número pedido:", error);
         showNotification('Erro ao gerar número. Tente novamente.', 'error');
         if(formButton) formButton.disabled = false; return;
    }

    const timestamp = new Date().toISOString();
    const pedidoData = {
      pedidoNumero, clienteNome, vendedorResponsavel, observacoes,
      agendamento: timestamp, itens, formaPagamento: FORMAS_PAGAMENTO[0],
      valorTotal: valorTotalInicial, desconto: 0, status: STATUS_LIST[0],
      createdAt: timestamp, lastUpdate: timestamp,
      // logs será adicionado depois
    };

    try {
        const newPedidoRef = db.ref('pedidos').push();
        const pedidoIdFirebase = newPedidoRef.key;
        const initialLog = { timestamp, user: currentUser.name, description: 'Pedido criado.', type: 'log' };
        // Adiciona o log inicial como o primeiro item do nó 'logs'
        await db.ref(`pedidos/${pedidoIdFirebase}/logs`).push(initialLog);
        // Define os dados principais do pedido
        await newPedidoRef.set(pedidoData);

        showNotification(`Pedido #${pedidoNumero} criado!`, 'success');
        if(pedidoModal) pedidoModal.classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar pedido:", error);
        showNotification(`Erro ao salvar: ${error.message}`, 'error');
    } finally {
         if(formButton) formButton.disabled = false; // Reabilita sempre
    }
};

const saveDetailsAndMaybeAdvance = async (advanceStatus = false) => {
    // Código completo da função saveDetailsAndMaybeAdvance
    const id = document.getElementById('logPedidoId')?.value;
     if (!id || !allPedidos[id]) { showNotification("Erro: ID do pedido inválido.", "error"); return false; }
     const pedidoAtual = allPedidos[id];
     const saveButton = document.getElementById('saveAndNextStatusBtn');

     if(saveButton) saveButton.disabled = true; // Desabilita

     const valorTotalCalculado = calculateDetailsTotal(false); // Calcula
     const updates = {
        itens: itensAdicionadosState,
        formaPagamento: document.getElementById('detailsFormaPagamento')?.value || pedidoAtual.formaPagamento,
        desconto: parseFloat(document.getElementById('detailsDesconto')?.value) || 0,
        valorTotal: valorTotalCalculado,
        lastUpdate: new Date().toISOString()
     };

     try {
        await db.ref(`pedidos/${id}`).update(updates); // Salva
        let notificationMessage = 'Alterações salvas!';
         if (advanceStatus) { // Se pediu para avançar
            const currentStatusIndex = STATUS_LIST.indexOf(pedidoAtual.status);
            const nextStatus = currentStatusIndex < STATUS_LIST.length - 1 ? STATUS_LIST[currentStatusIndex + 1] : null;
            if (nextStatus) {
                await updatePedidoStatus(id, nextStatus); // Avança (já salva log)
                notificationMessage = 'Salvo e status avançado!';
            } else { notificationMessage = 'Salvo! Já no último status.'; }
         }
         showNotification(notificationMessage, 'success');
        if(detailsModal) detailsModal.classList.add('hidden'); // Fecha
        return true; // Sucesso
     } catch (error) {
         console.error("Erro ao salvar/avançar:", error);
         showNotification(`Erro ao salvar: ${error.message}`, 'error');
         return false; // Falha
     } finally {
          if(saveButton) saveButton.disabled = false; // Reabilita
     }
};

const saveLogAndUploads = async (e) => {
    // Código completo da função saveLogAndUploads
   e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    const pedidoId = document.getElementById('logPedidoId')?.value;
    const descriptionInput = document.getElementById('logDescricao');
    const description = descriptionInput ? descriptionInput.value.trim() : '';
    if (!pedidoId) { showNotification("Erro: ID do pedido não encontrado.", "error"); return; }
    if (!description && filesToUpload.length === 0) { showNotification("Digite descrição ou selecione arquivos.", "warning"); return; }

    submitBtn.disabled = true; submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin mr-2'></i> Salvando...`;
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, user: currentUser.name, type: 'log',
        description: description || `Adicionou ${filesToUpload.length} mídia(s).` };

    try {
        await db.ref(`pedidos/${pedidoId}/logs`).push(logEntry); // Salva log
        if (filesToUpload.length > 0) { // Processa uploads
            submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin mr-2'></i> Enviando ${filesToUpload.length} mídia(s)...`;
            const uploadPromises = filesToUpload.map(async file => {
                const url = await uploadFileToCloudinary(file);
                return { type: file.type || 'application/octet-stream', url, name: file.name, timestamp };
            });
            const mediaResults = await Promise.all(uploadPromises);
            const mediaRef = db.ref(`pedidos/${pedidoId}/media`);
            for (const result of mediaResults) { await mediaRef.push().set(result); } // Salva refs da mídia
        }
        if(logForm) logForm.reset(); filesToUpload = []; if(fileNameDisplay) fileNameDisplay.textContent = ''; // Limpa
        showNotification('Atualização adicionada!', 'success');
    } catch (error) {
         if (!error.message || !error.message.includes('upload')) { showNotification(`Erro: ${error.message || 'Erro desconhecido'}`, 'error'); }
         console.error("Erro em saveLogAndUploads:", error);
    } finally {
        submitBtn.disabled = false; submitBtn.innerHTML = `<i class='bx bx-message-square-add mr-2'></i> Adicionar ao Histórico`;
    }
};

// --- Funções do Modal de Detalhes (renderTimeline, renderMediaGallery, openLightbox, etc.) ---
// --- Estas funções permanecem EXATAMENTE como na resposta anterior ---
// --- Vou incluí-las aqui na íntegra para garantir ---

const renderTimeline = (pedido) => {
   const timelineContainer = document.getElementById('timelineContainer');
    if (!timelineContainer) { console.warn("Elemento timelineContainer não encontrado."); return; }
    const logs = pedido.logs ? Object.entries(pedido.logs).map(([key, value]) => ({ ...value, id: key })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
    if (logs.length === 0) { timelineContainer.innerHTML = '<p class="text-gray-500 text-center py-4 text-sm italic">Nenhum histórico registrado.</p>'; return; }
    timelineContainer.innerHTML = logs.map(log => {
         const iconClass = log.type === 'status' ? 'bx-transfer' : 'bx-message-detail';
         const iconColor = log.type === 'status' ? 'text-green-600 border-green-500' : 'text-blue-600 border-blue-500';
         const userDisplay = log.user || 'Sistema';
         return `<div class="timeline-item ${log.type === 'status' ? 'timeline-item-status' : 'timeline-item-log'}"><div class="timeline-icon ${iconColor}"><i class='bx ${iconClass}'></i></div><div class="bg-white p-3 rounded-lg shadow-sm border border-gray-200 ml-2 relative"><div class="flex justify-between items-start mb-1 gap-2"><h4 class="font-semibold text-gray-700 text-sm flex-grow">${userDisplay}</h4><span class="text-xs text-gray-500 flex-shrink-0">${formatDateTime(log.timestamp)}</span></div><p class="text-gray-600 text-sm break-words">${log.description || '(Sem descrição)'}</p></div></div>`;
    }).join('');
};

const renderMediaGallery = (pedido) => {
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    if(!thumbnailGrid) { console.warn("Elemento thumbnail-grid não encontrado."); return; }
    const media = pedido.media || {};
    const mediaEntries = Object.entries(media).map(([key, item]) => ({ ...item, key: key }));
    lightboxMedia = mediaEntries;
    if (mediaEntries.length === 0) { thumbnailGrid.innerHTML = `<div class="col-span-full text-center py-6 text-gray-400"><i class='bx bx-image bx-sm mb-2'></i><p class="text-xs italic">Nenhuma mídia.</p></div>`; return; }
    thumbnailGrid.innerHTML = mediaEntries.map((item, index) => {
        if (!item || !item.url) return '';
        const canDelete = currentUser?.role?.toLowerCase().includes('gestor');
        const deleteButtonHTML = canDelete ? `<button class="delete-media-btn z-10" data-pedido-id="${pedido.id}" data-media-key="${item.key}" title="Excluir"><i class='bx bxs-trash bx-xs'></i></button>` : '';
        const fileType = item.type || ''; const isImage = fileType.startsWith('image/'); const isVideo = fileType.startsWith('video/'); const isPdf = fileType === 'application/pdf';
        const fileName = item.name || `Arquivo_${index + 1}`;
        let thumbnailContent;
        if (isImage) { thumbnailContent = `<img src="${item.url}" alt="${fileName}" loading="lazy" class="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-105">`; }
        else if (isVideo) { thumbnailContent = `<div class="flex flex-col items-center justify-center h-full p-1 text-center"><i class='bx bx-play-circle text-3xl text-blue-500'></i><span class="text-xs text-gray-600 mt-1 truncate w-full px-1" title="${fileName}">${fileName}</span></div>`; }
        else if (isPdf) { thumbnailContent = `<div class="flex flex-col items-center justify-center h-full p-1 text-center"><i class='bx bxs-file-pdf text-3xl text-red-500'></i><span class="text-xs text-gray-600 mt-1 truncate w-full px-1" title="${fileName}">${fileName}</span></div>`; }
        else { thumbnailContent = `<div class="flex flex-col items-center justify-center h-full p-1 text-center"><i class='bx bx-file text-3xl text-gray-400'></i><span class="text-xs text-gray-500 mt-1 truncate w-full px-1" title="${fileName}">${fileName}</span></div>`; }
        return `<div class="thumbnail-container group bg-gray-100 rounded-md overflow-hidden flex items-center justify-center relative border border-gray-300 hover:shadow-lg transition-shadow aspect-square">${deleteButtonHTML}<div class="thumbnail-item w-full h-full cursor-pointer flex items-center justify-center relative" data-index="${index}">${thumbnailContent}</div></div>`;
    }).join('');
};

const openLightbox = (index) => {
    if (!lightboxMedia || index < 0 || index >= lightboxMedia.length) { console.warn("Índice lightbox inválido:", index); return; }
    currentLightboxIndex = index; const media = lightboxMedia[index];
    if (!media || !media.url) { console.warn("Mídia inválida:", index, media); showNotification("Não foi possível abrir.", "error"); return; }
    const lightboxContent = document.getElementById('lightbox-content'); if(!lightboxContent) return;
    lightboxContent.innerHTML = '<p class="text-white animate-pulse text-center">Carregando...</p>';
    if (media.type === 'application/pdf') { lightboxContent.innerHTML = `<div class="text-center p-6 bg-gray-800 rounded"><i class='bx bxs-file-pdf text-6xl text-red-400 mb-4'></i><p class="text-gray-300 text-sm mb-4 break-all">${media.name || 'PDF'}</p><a href="${media.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded hover:bg-red-700 transition-colors"><i class='bx bx-link-external'></i>Abrir PDF</a></div>`; }
    else if (media.type?.startsWith('image/')) { const img = new Image(); img.onload = () => { lightboxContent.innerHTML = ''; lightboxContent.appendChild(img); }; img.onerror = () => { lightboxContent.innerHTML = '<p class="text-red-400 text-center">Erro ao carregar.</p>'; }; img.src = media.url; img.alt = media.name || 'Imagem'; img.className = "block max-w-full max-h-full object-contain rounded shadow-lg"; }
    else if (media.type?.startsWith('video/')) { lightboxContent.innerHTML = `<video src="${media.url}" controls controlsList="nodownload" class="block max-w-full max-h-full rounded shadow-lg"></video>`; }
    else { lightboxContent.innerHTML = `<div class="text-center p-6 bg-gray-800 rounded"><i class='bx bx-file text-6xl text-gray-400 mb-4'></i><p class="text-gray-300 text-sm mb-4 break-all">${media.name || 'Arquivo'}</p><a href="${media.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 transition-colors"><i class='bx bx-download'></i>Abrir/Baixar</a></div>`; }
    if(lightbox){ lightbox.classList.remove('hidden'); lightbox.classList.add('flex'); }
};

/* ==================================================================
MODAL DE CONFIGURAÇÃO - Funções
==================================================================
*/
const openConfigModal = () => {
    // Código completo da função openConfigModal
    renderConfigLists();
     if(configModal){
        configModal.classList.remove('hidden');
        configModal.classList.add('flex');
     } else {
         console.error("Modal de configuração não encontrado.");
     }
};
const renderConfigLists = () => {
    // Código completo da função renderConfigLists
   const servicosListContainer = document.getElementById('configServicosList');
    if (!servicosListContainer) { console.warn("Elemento configServicosList não encontrado."); return; }
    const produtos = Array.isArray(configData.produtos) ? configData.produtos : [];
     if (produtos.length === 0) { servicosListContainer.innerHTML = '<p class="text-gray-500 text-sm text-center italic p-4">Nenhum produto cadastrado.</p>'; return; }
     produtos.sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Ordena
    servicosListContainer.innerHTML = produtos.map((p, i) => `
      <div class="flex justify-between items-center bg-white p-3 rounded border border-gray-200 shadow-sm mb-2 transition-colors hover:bg-gray-50">
        <span class="text-sm text-gray-800 flex-grow mr-2">${p.name} - ${formatCurrency(p.price)}</span>
        <button class="remove-servico-btn text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 text-xl leading-none flex-shrink-0" data-index="${i}" title="Excluir Produto">&times;</button>
      </div>`).join('');
};
const addProdutoConfig = async (e) => {
    // Código completo da função addProdutoConfig
    e.preventDefault();
    const nameInput = document.getElementById('newServicoName');
    const priceInput = document.getElementById('newServicoPrice');
    const addButton = e.target.querySelector('button[type="submit"]');
    const name = nameInput ? nameInput.value.trim() : '';
    const price = priceInput ? parseFloat(priceInput.value) : 0;
    if (!name || isNaN(price) || price <= 0) { showNotification("Nome e preço (> 0) são obrigatórios.", "error"); return; }
    if (!Array.isArray(configData.produtos)) configData.produtos = [];
    const exists = configData.produtos.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists) { showNotification(`Produto "${name}" já existe.`, "error"); return; }
    if(addButton) addButton.disabled = true;
    const newProduct = { name, price };
    const tentativeProductList = [...configData.produtos, newProduct];
    try {
        await db.ref('config/produtos').set(tentativeProductList);
        configData.produtos = tentativeProductList;
        renderConfigLists();
        if(nameInput) nameInput.value = ''; if(priceInput) priceInput.value = '';
        showNotification(`"${name}" adicionado!`, "success");
    } catch (error) { console.error("Erro ao salvar produto:", error); showNotification("Erro ao salvar.", "error"); }
    finally { if(addButton) addButton.disabled = false; }
};
const removeProdutoConfig = async (e) => {
    // Código completo da função removeProdutoConfig
    if (e.target.classList.contains('remove-servico-btn')) {
        const index = parseInt(e.target.dataset.index);
        if (!isNaN(index) && configData.produtos?.[index]) {
             const produtoParaRemover = configData.produtos[index];
            if (confirm(`Remover "${produtoParaRemover.name}"?`)) {
                const produtosAtualizados = configData.produtos.filter((_, i) => i !== index);
                e.target.disabled = true; // Desabilita botão
                try {
                    await db.ref('config/produtos').set(produtosAtualizados);
                    configData.produtos = produtosAtualizados;
                    renderConfigLists();
                    showNotification(`"${produtoParaRemover.name}" removido.`, "success");
                } catch (error) { console.error("Erro ao remover:", error); showNotification("Erro.", "error"); e.target.disabled = false; } // Reabilita se falhar
            }
        }
    }
};

/* ==================================================================
BUSCA GLOBAL
==================================================================
*/
const handleGlobalSearch = () => {
    // Código completo da função handleGlobalSearch
    if(!globalSearchInput || !globalSearchResults) { console.warn("Elementos de busca não encontrados."); return; }
    const searchTerm = globalSearchInput.value.toLowerCase().trim();
     if (!searchTerm) { globalSearchResults.innerHTML = ''; globalSearchResults.classList.add('hidden'); return; }
    const results = Object.values(allPedidos).filter(p => (p.clienteNome&&p.clienteNome.toLowerCase().includes(searchTerm)) || (p.pedidoNumero&&String(p.pedidoNumero).includes(searchTerm)) || (p.id&&p.id.toLowerCase().includes(searchTerm.replace('#',''))) || (Array.isArray(p.itens)&&p.itens.some(i=>i.name&&i.name.toLowerCase().includes(searchTerm))) || (p.vendedorResponsavel&&p.vendedorResponsavel.toLowerCase().includes(searchTerm)) ).sort((a,b)=>new Date(b.lastUpdate||b.createdAt||0)-new Date(a.lastUpdate||a.createdAt||0)).slice(0,10);
     if (results.length > 0) {
         globalSearchResults.innerHTML = results.map(p => `<div class="search-result-item p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 transition-colors" data-id="${p.id}"><p class="font-semibold text-sm text-gray-800 truncate">${p.clienteNome||'Cliente'} (#${p.pedidoNumero||p.id.slice(-5)})</p><p class="text-xs text-gray-500">${p.vendedorResponsavel||'N/A'} - <span class="font-medium ${p.status==='Entregue'?'text-green-600':'text-blue-600'}">${formatStatus(p.status)}</span></p></div>`).join('');
         globalSearchResults.classList.remove('hidden');
     } else { globalSearchResults.innerHTML = '<p class="p-3 text-center text-sm text-gray-500 italic">Nenhum pedido encontrado.</p>'; globalSearchResults.classList.remove('hidden'); }
};

/* ==================================================================
CONFIGURAÇÃO DOS LISTENERS DE EVENTOS GERAIS
==================================================================
*/
const setupEventListeners = () => {
    // Código completo da função setupEventListeners
   console.log("Configurando listeners de eventos...");

    // --- Login / Logout ---
    if (userList) {
        userList.addEventListener('click', (e) => {
            const userBtn = e.target.closest('.user-btn');
            if (userBtn && userBtn.dataset.user) {
                try {
                   const userData = JSON.parse(userBtn.dataset.user.replace(/&apos;/g, "'"));
                   loginUser(userData);
                } catch(err){ console.error("Erro no JSON do botão de usuário:", err, userBtn.dataset.user); }
            }
        });
    } else { console.warn("Elemento userList não encontrado."); }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('eletroIAUser');
            try { if (db) db.ref('pedidos').off(); console.log("Listener 'pedidos' desligado."); } // Verifica db
            catch(e) { console.warn("Erro ao desligar listener 'pedidos':", e); }
            location.reload();
        });
    } else { console.warn("Botão logoutButton não encontrado."); }

    // --- Abrir Modais Principais ---
    if(addPedidoBtn) addPedidoBtn.addEventListener('click', openNewPedidoModal); else { console.warn("Botão addPedidoBtn não encontrado."); }
    if(configBtn) configBtn.addEventListener('click', openConfigModal); else { console.warn("Botão configBtn não encontrado."); }

    // --- Salvar Formulários Principais ---
    if(pedidoForm) pedidoForm.addEventListener('submit', saveNewPedido); else { console.warn("Formulário pedidoForm não encontrado."); }
    const addServicoForm = document.getElementById('addServicoForm');
    if(addServicoForm) addServicoForm.addEventListener('submit', addProdutoConfig); else { console.warn("Formulário addServicoForm não encontrado."); }

    // --- Fechar Modais (Genérico) ---
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.btn-close-modal')) {
            const modal = e.target.closest('.modal-backdrop');
            if (modal) modal.classList.add('hidden');
        }
        else if (e.target.classList.contains('modal-backdrop') && e.target.id !== 'lightbox') {
             e.target.classList.add('hidden');
        }
    });
     // Fechar Lightbox
     const lightboxCloseBtn = document.getElementById('lightbox-close');
     if(lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', () => { if(lightbox) lightbox.classList.add('hidden'); });
     const lightboxCloseBg = document.getElementById('lightbox-close-bg');
     if(lightboxCloseBg) lightboxCloseBg.addEventListener('click', () => { if(lightbox) lightbox.classList.add('hidden'); });

    // --- Ações no Kanban ---
    if (vendedorDashboard) {
        vendedorDashboard.addEventListener('click', (e) => {
            const moveBtn = e.target.closest('.btn-move-status');
            const cardArea = e.target.closest('.card-clickable-area');
            if (moveBtn && moveBtn.dataset.id && moveBtn.dataset.newStatus) {
              e.stopPropagation();
              updatePedidoStatus(moveBtn.dataset.id, moveBtn.dataset.newStatus);
            } else if (cardArea) {
              const card = e.target.closest('.vehicle-card');
              if (card && card.dataset.id) openDetailsModal(card.dataset.id);
            }
        });
    } else { console.warn("Elemento vendedorDashboard não encontrado para listeners Kanban."); }

    // --- Ações no Modal de Detalhes ---
    if(detailsModal){
         detailsModal.addEventListener('click', (e) => {
            // Adicionar Item
            if (e.target.id === 'detailsAddServicoBtn') {
                const select = document.getElementById('detailsServicosList');
                if (select && select.value) {
                    const [name, priceStr] = select.value.split('|');
                    const price = parseFloat(priceStr);
                    if(name && !isNaN(price)){
                        itensAdicionadosState.push({ name, price });
                        renderDetailsItems();
                        calculateDetailsTotal(false);
                        select.value = "";
                    } else { console.warn("Seleção inválida:", select.value); }
                }
            }
            // Remover Item
            else if (e.target.classList.contains('remove-item-btn')) {
                const index = parseInt(e.target.dataset.index);
                if (!isNaN(index) && index >= 0 && index < itensAdicionadosState.length) {
                    itensAdicionadosState.splice(index, 1);
                    renderDetailsItems();
                    calculateDetailsTotal(false);
                } else { console.warn("Índice inválido:", e.target.dataset.index); }
            }
         });

        const descontoInput = document.getElementById('detailsDesconto');
        if(descontoInput) descontoInput.addEventListener('input', () => calculateDetailsTotal(false));
        else { console.warn("Input detailsDesconto não encontrado."); }

        const saveAndNextBtn = document.getElementById('saveAndNextStatusBtn');
        if(saveAndNextBtn) saveAndNextBtn.addEventListener('click', () => saveDetailsAndMaybeAdvance(true));
        else { console.warn("Botão saveAndNextStatusBtn não encontrado."); }

         if(deleteBtn) deleteBtn.addEventListener('click', (e) => {
            const id = e.target.dataset.id || e.target.closest('[data-id]')?.dataset.id;
            const pedido = allPedidos[id];
            if(pedido && confirmDeleteText && confirmDeleteBtn && confirmDeleteModal){
                confirmDeleteText.innerHTML = `Excluir Pedido <strong>#${pedido.pedidoNumero || id.slice(-5)}</strong> de <strong>${pedido.clienteNome || 'Cliente'}</strong>? <br><strong class="text-red-600">Ação irreversível.</strong>`;
                confirmDeleteBtn.dataset.id = id;
                confirmDeleteModal.classList.remove('hidden');
                confirmDeleteModal.classList.add('flex');
            } else { console.warn("Não foi possível abrir confirmação de exclusão."); }
         });
         else { console.warn("Botão deleteBtn não encontrado."); }
    } else { console.warn("Modal detailsModal não encontrado."); }

     // --- Confirmação de Exclusão (Pedido) ---
     if(confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
         if (id && confirmDeleteModal) {
             confirmDeleteBtn.disabled = true;
             confirmDeleteBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin mr-2'></i> Excluindo...";
             db.ref(`pedidos/${id}`).remove()
                .then(() => {
                    if(detailsModal) detailsModal.classList.add('hidden');
                    confirmDeleteModal.classList.add('hidden');
                    showNotification('Pedido excluído.', 'success');
                })
                .catch(error => { console.error("Erro ao excluir:", error); showNotification("Erro ao excluir.", "error"); })
                .finally(() => { confirmDeleteBtn.disabled = false; confirmDeleteBtn.innerHTML = "Sim, Excluir"; });
         }
     });
     else { console.warn("Botão confirmDeleteBtn não encontrado."); }

     if(cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => { if(confirmDeleteModal) confirmDeleteModal.classList.add('hidden'); });
     else { console.warn("Botão cancelDeleteBtn não encontrado."); }


    // --- Formulário de Log e Uploads ---
    if(logForm) logForm.addEventListener('submit', saveLogAndUploads);
    else { console.warn("Formulário logForm não encontrado."); }

    if(openCameraBtn) openCameraBtn.addEventListener('click', () => {
        if(mediaInput) { mediaInput.setAttribute('accept', 'image/*'); mediaInput.setAttribute('capture', 'environment'); mediaInput.multiple = true; mediaInput.value = null; mediaInput.click(); }
        else { console.warn("Input media-input não encontrado para câmera."); }
    });
    else { console.warn("Botão openCameraBtn não encontrado."); }

    if(openGalleryBtn) openGalleryBtn.addEventListener('click', () => {
        if(mediaInput){ mediaInput.setAttribute('accept', 'image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.rar'); mediaInput.removeAttribute('capture'); mediaInput.multiple = true; mediaInput.value = null; mediaInput.click(); }
        else { console.warn("Input media-input não encontrado para galeria."); }
    });
    else { console.warn("Botão openGalleryBtn não encontrado."); }

    if(mediaInput) mediaInput.addEventListener('change', (e) => {
        filesToUpload = Array.from(e.target.files);
        if(fileNameDisplay) fileNameDisplay.textContent = filesToUpload.length > 0 ? `${filesToUpload.length} arquivo(s)` : '';
    });
    else { console.warn("Input media-input não encontrado."); }

    // --- Galeria de Mídia e Lightbox ---
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    if(thumbnailGrid) thumbnailGrid.addEventListener('click', (e) => {
        const thumbnailItem = e.target.closest('.thumbnail-item');
         const deleteButton = e.target.closest('.delete-media-btn');
         if (deleteButton) {
             e.stopPropagation();
             const { pedidoId, mediaKey } = deleteButton.dataset;
             if (pedidoId && mediaKey && confirm('Excluir esta mídia?')) {
                 deleteButton.innerHTML = "<i class='bx bx-loader-alt bx-spin bx-xs'></i>"; deleteButton.disabled = true;
                 db.ref(`pedidos/${pedidoId}/media/${mediaKey}`).remove()
                   .then(() => showNotification("Mídia excluída.", "success"))
                   .catch(err => { console.error("Erro ao excluir:", err); showNotification("Erro.", "error"); deleteButton.innerHTML = "<i class='bx bxs-trash bx-xs'></i>"; deleteButton.disabled = false; });
             }
         } else if (thumbnailItem && thumbnailItem.dataset.index !== undefined) {
            openLightbox(parseInt(thumbnailItem.dataset.index));
         }
    });
    else { console.warn("Elemento thumbnail-grid não encontrado."); }

     // --- Ações no Modal de Configuração ---
     if(configModal) configModal.addEventListener('click', removeProdutoConfig);
     else { console.warn("Modal configModal não encontrado."); }

     // --- Busca Global ---
     if(globalSearchInput) globalSearchInput.addEventListener('input', handleGlobalSearch);
     else { console.warn("Input globalSearchInput não encontrado."); }

     if(globalSearchResults) globalSearchResults.addEventListener('click', (e) => {
         const resultItem = e.target.closest('.search-result-item');
          if (resultItem && resultItem.dataset.id) {
              openDetailsModal(resultItem.dataset.id);
              if(globalSearchInput) globalSearchInput.value = '';
              globalSearchResults.innerHTML = ''; globalSearchResults.classList.add('hidden');
          }
     });
     else { console.warn("Elemento globalSearchResults não encontrado."); }
     // Esconder busca
     document.addEventListener('click', (e) => {
         const searchContainer = e.target.closest('.search-container');
         if (!searchContainer && globalSearchResults && !globalSearchResults.classList.contains('hidden')) { globalSearchResults.classList.add('hidden'); }
     });

    console.log("Todos os listeners de eventos foram configurados.");
};


/* ==================================================================
INICIALIZAÇÃO DA APLICAÇÃO
==================================================================
*/
// Garante que o DOM esteja pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        checkLoggedInUser(); // Verifica login
        setupEventListeners(); // Configura eventos
    });
} else {
    // DOM já pronto
    checkLoggedInUser();
    setupEventListeners();
}

// --- FIM DO CÓDIGO ---
