/* ==================================================================
PROTÓTIPO HÍBRIDO EletroIA-MVP
Motor:
- Arquitetura de UI Multi-Vendedor (Base: Habibi)
- Fluxo de Pedidos e Mídia (Base: Chevron)
- Lógica de Produtos (Base: Habibi/Techmess)
Versão: Completa e Integral (Sem Omissões) - 23/10/2025
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
  storageBucket: "eletroia-distribuidora.appspot.com", // Mantendo como appspot.com, que é o padrão comum. Se o seu for firebasestorage.app, ajuste aqui.
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
  // Remove notificações existentes para evitar sobreposição
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => notif.remove());

  const notification = document.createElement('div');
  notification.id = 'notification'; // ID pode ser mantido se a lógica de remoção for robusta
  notification.className = `notification ${type}`; // Adiciona tipo para cor
  notification.textContent = message;
  document.body.appendChild(notification);
  // Força reflow para garantir que a transição ocorra
  void notification.offsetWidth;
  notification.classList.add('show');

  // Agenda a remoção da notificação
  setTimeout(() => {
    notification.classList.remove('show');
    // Espera a transição de saída terminar antes de remover do DOM
    notification.addEventListener('transitionend', () => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, { once: true }); // Garante que o listener seja removido após a execução
  }, 4000); // Tempo que a notificação fica visível
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
    showNotification(`Enviando ${file.name}...`, 'warning'); // Feedback inicial
    const response = await fetch(apiUrl, { method: 'POST', body: formData });

    if (!response.ok) {
       const errorData = await response.json();
       console.error("Erro Cloudinary:", errorData);
       throw new Error(errorData.error?.message || `Falha no upload (${response.status})`);
    }
    const data = await response.json();
     showNotification(`'${file.name}' enviado com sucesso!`, 'success');
    return data.secure_url; // Retorna a URL segura

  } catch (error) {
    console.error("Erro no upload para o Cloudinary:", error);
    showNotification(`Erro no upload de ${file.name}: ${error.message}`, 'error');
    throw error; // Propaga o erro
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
let filesToUpload = []; // Fila de arquivos para upload
let initialDataLoaded = false; // Flag para carga inicial do Firebase

// Constantes
const FORMAS_PAGAMENTO = ['PIX', 'Boleto', 'Cartão de Crédito', 'Dinheiro', 'Transferência'];
const STATUS_LIST = ['Novos-Leads', 'Em-Negociacao', 'Aguardando-Pagamento', 'Entregue'];

// Seletores DOM
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
try {
    if (!firebase.apps.length) {
       firebase.initializeApp(firebaseConfig);
       console.log("Firebase inicializado com sucesso.");
    } else {
       firebase.app();
       console.log("Firebase já estava inicializado.");
    }
} catch(e) {
    console.error("Erro CRÍTICO ao inicializar Firebase:", e);
    setTimeout(() => showNotification("Erro crítico: Falha ao conectar com o banco de dados. Verifique as credenciais no app.js.", "error"), 500);
}
const db = firebase.database();

/* ==================================================================
LÓGICA DE LOGIN E AUTENTICAÇÃO
==================================================================
*/
const loadVendedores = async () => {
     try {
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
             // Se não encontrar no Firebase, usa a lista simulada
             console.warn("Nenhum vendedor encontrado ou formato inválido no Firebase. Usando lista simulada.");
             vendedores = [
                { name: 'Thiago', role: 'Vendedor 1' },
                { name: 'Raul', role: 'Vendedor 2' },
                { name: 'Guilherme', role: 'Gestor' }
             ];
             // Opcional: Tentar salvar a lista simulada no Firebase se estiver vazio?
             // await db.ref('vendedores').set(vendedores.reduce((obj, v) => { obj[v.name] = { name: v.name, role: v.role }; return obj; }, {}));
        }
         if(vendedores.length === 0){
              console.error("CRÍTICO: Nenhuma lista de vendedores disponível (nem Firebase, nem simulada).");
              showNotification("Erro: Não foi possível carregar a lista de vendedores.", "error");
         }
     } catch (error) {
         console.error("Erro ao carregar vendedores:", error);
         showNotification("Erro ao carregar lista de vendedores.", "error");
         vendedores = []; // Define como vazio em caso de erro grave
     }
};

const loginUser = async (user) => {
    if (!user || !user.name) {
        console.error("Tentativa de login com usuário inválido:", user);
        showNotification("Erro: Usuário inválido selecionado.", "error");
        return;
    }
    currentUser = user;
    localStorage.setItem('eletroIAUser', JSON.stringify(user));
    const userNameDisplay = document.getElementById('currentUserName');
    if(userNameDisplay) userNameDisplay.textContent = user.name;

    if(configBtn) configBtn.classList.toggle('hidden', !(user.role && user.role.toLowerCase().includes('gestor')));

    userScreen.classList.add('hidden');
    app.classList.remove('hidden');

    // Mostra feedback de carregamento
    if(vendedorDashboard) vendedorDashboard.innerHTML = '<p class="text-center text-gray-500 my-10 animate-pulse">Carregando dados...</p>';

    await loadConfig(); // Carrega produtos ANTES de montar dashboard
    initializeDashboard(); // Monta interface vazia
    listenToPedidos(); // Inicia monitoramento (que preencherá a interface)
};

const checkLoggedInUser = async () => {
    await loadVendedores(); // Carrega vendedores PRIMEIRO
    const storedUser = localStorage.getItem('eletroIAUser');
    if (storedUser) {
        try {
           const parsedUser = JSON.parse(storedUser);
           // Valida se o usuário salvo ainda existe na lista carregada
           if(vendedores.some(v => v.name === parsedUser.name)){
               loginUser(parsedUser); // Faz login
           } else {
                console.warn("Usuário salvo não encontrado na lista atual. Forçando logout.");
                localStorage.removeItem('eletroIAUser');
                displayLoginScreen(); // Mostra tela de login
           }
        } catch(e) {
             console.error("Erro ao parsear usuário salvo:", e);
             localStorage.removeItem('eletroIAUser');
             displayLoginScreen();
        }
    } else {
       displayLoginScreen(); // Mostra tela de login se não houver sessão
    }
};

const displayLoginScreen = () => {
     userScreen.classList.remove('hidden');
     app.classList.add('hidden');
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
          console.error("Elemento userList não encontrado para exibir vendedores.");
          alert("Erro crítico: Interface de login não carregou corretamente.");
     }
};


/* ==================================================================
LÓGICA DO DASHBOARD
==================================================================
*/
const initializeDashboard = () => {
    if (!vendedorDashboard) {
        console.error("Elemento vendedorDashboard não encontrado no DOM.");
         showNotification("Erro ao carregar a interface principal.", "error");
        return;
    }
     if (vendedores.length === 0) {
         vendedorDashboard.innerHTML = '<p class="text-center text-red-500 my-10">Erro: Nenhum vendedor carregado. Verifique a configuração no Firebase.</p>';
         return;
     }
    // Limpa o conteúdo existente antes de recriar
    vendedorDashboard.innerHTML = '';
    vendedores.forEach(vendedor => {
        const vendedorSection = document.createElement('section');
        vendedorSection.className = 'vendedor-section';
        vendedorSection.id = `section-${vendedor.name.replace(/\s+/g, '-')}`; // ID único

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
            clientList.dataset.vendedor = vendedor.name; // Associa a lista ao vendedor
            clientList.innerHTML = '<p class="text-center text-gray-400 text-xs italic p-4">Carregando...</p>'; // Placeholder inicial
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
    const ref = db.ref('pedidos');
    initialDataLoaded = false;

    if (vendedorDashboard) {
        vendedorDashboard.querySelectorAll('.client-list').forEach(list => list.innerHTML = '<p class="text-center text-gray-400 text-xs italic p-4 animate-pulse">Carregando...</p>');
    } else {
         console.error("Dashboard não encontrado ao iniciar listeners.");
         return;
    }
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
        // Nota: O 'startAt' pode precisar de ajuste dependendo de como 'createdAt' é salvo (timestamp ou ISO string)
        // Se usar ISO string, pode não funcionar como esperado sem indexes. Considerar remover para protótipo.
        // Removendo startAt para simplicidade no protótipo:
    // ref.on('child_added', snapshot => { // Ouvir todos os 'child_added'
        // if (!initialDataLoaded) return; // Ainda necessário para evitar duplicatas da carga inicial

        const pedido = { ...snapshot.val(), id: snapshot.key };
        // Adiciona ao cache e renderiza SOMENTE se não existia durante a carga inicial
        if (!allPedidos[pedido.id]) {
            console.log("Listener 'child_added' detectou novo pedido:", pedido.id);
            allPedidos[pedido.id] = pedido;
            renderCard(pedido);
        } else {
             //console.log("Listener 'child_added' ignorou pedido já carregado:", pedido.id);
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
        const snapshot = await db.ref('config').once('value');
        configData = snapshot.val() || { produtos: [] };
        if (configData.produtos && typeof configData.produtos === 'object' && !Array.isArray(configData.produtos)) {
            // Converte objeto Firebase (-Lsdf98sdf: {name...}) em array
            configData.produtos = Object.values(configData.produtos);
        } else if (!Array.isArray(configData.produtos)) {
             configData.produtos = []; // Garante que seja um array
        }
         console.log("Configuração (produtos) carregada:", configData.produtos.length, "itens.");
    } catch (error) {
        console.error("Erro ao carregar configuração /config:", error);
        showNotification("Erro ao carregar a lista de produtos do sistema.", "error");
        configData = { produtos: [] }; // Usa array vazio como fallback
    }
};


/* ==================================================================
FUNÇÕES DE MANIPULAÇÃO DE PEDIDOS
==================================================================
*/
const updatePedidoStatus = async (id, newStatus) => {
    // Código completo da função updatePedidoStatus
    const pedido = allPedidos[id];
    // Validações
    if (!pedido) { showNotification("Erro: Pedido não encontrado para alterar status.", "error"); return; }
    if (!newStatus) { showNotification("Erro: Novo status inválido.", "error"); return; }
    if (!STATUS_LIST.includes(newStatus)) { showNotification(`Erro: Status "${newStatus}" não é válido.`, "error"); return; }
    if (pedido.status === newStatus) return; // Já está no status desejado

    const oldStatus = pedido.status;
    const logEntry = {
        timestamp: new Date().toISOString(),
        user: currentUser.name,
        description: `Status alterado de "${formatStatus(oldStatus)}" para "${formatStatus(newStatus)}".`,
        type: 'status' // Marca como log de mudança de status
    };
    try {
         // 1. Adiciona o log primeiro (importante ter registro da ação)
         await db.ref(`pedidos/${id}/logs`).push(logEntry);
         // 2. Atualiza o status e a data da última modificação
         await db.ref(`pedidos/${id}`).update({ status: newStatus, lastUpdate: new Date().toISOString() });
         // Notificação opcional de sucesso
         // showNotification(`Status do pedido #${pedido.pedidoNumero || id.slice(-5)} atualizado!`, "success");
    } catch (error) {
        console.error("Erro ao atualizar status do pedido:", error);
        showNotification("Falha ao mover pedido. Verifique o console.", "error");
        // Considerar reverter o log aqui seria mais robusto, mas complexo
    }
};

const saveNewPedido = async (e) => {
    // Código completo da função saveNewPedido
    e.preventDefault(); // Impede recarregamento da página
    const clienteNomeInput = document.getElementById('clienteNome');
    const vendedorSelect = document.getElementById('vendedorResponsavel');
    const observacoesInput = document.getElementById('pedidoObservacoes');
    const formButton = pedidoForm ? pedidoForm.querySelector('button[type="submit"]') : null;

    // Desabilita botão para evitar cliques duplos
    if(formButton) formButton.disabled = true;

    const clienteNome = clienteNomeInput ? clienteNomeInput.value.trim() : '';
    const vendedorResponsavel = vendedorSelect ? vendedorSelect.value : '';
    const observacoes = observacoesInput ? observacoesInput.value.trim() : '';

    if (!clienteNome || !vendedorResponsavel) {
         showNotification("Nome do cliente e vendedor são obrigatórios.", "error");
         if(formButton) formButton.disabled = false; // Reabilita botão
         return;
    }

    const selectedItensCheckboxes = Array.from(document.querySelectorAll('#servicosList input:checked'));
    const itens = selectedItensCheckboxes.map(input => ({
        name: input.dataset.name,
        price: parseFloat(input.value) || 0
    }));
    const valorTotalInicial = itens.reduce((sum, item) => sum + item.price, 0);

    let pedidoNumero = 1000; // Número padrão inicial
    try {
         const configRef = db.ref('config/proximoPedido');
         // Usa transaction para garantir número único atomicamente
         const { committed, snapshot } = await configRef.transaction(currentValue => {
             // Se não existir, começa em 1001. Senão, incrementa.
             return (currentValue || 1000) + 1;
         });
         if (committed && snapshot.val()) {
             pedidoNumero = snapshot.val();
         } else {
              throw new Error("Falha na transação do número do pedido no Firebase.");
         }
    } catch (error) {
         console.error("Erro ao gerar número sequencial do pedido:", error);
         showNotification('Erro ao gerar número do pedido. Tente novamente.', 'error');
         if(formButton) formButton.disabled = false; // Reabilita botão
         return; // Aborta se não conseguir número
    }

    const agora = new Date();
    const timestamp = agora.toISOString();

    // Monta o objeto completo do pedido
    const pedidoData = {
      pedidoNumero, clienteNome, vendedorResponsavel, observacoes,
      agendamento: timestamp, // Data/Hora de criação
      itens: itens,
      formaPagamento: FORMAS_PAGAMENTO[0], // Usa o primeiro da lista como padrão
      valorTotal: valorTotalInicial, desconto: 0,
      status: STATUS_LIST[0], // Status inicial ('Novos-Leads')
      createdAt: timestamp, lastUpdate: timestamp,
      // 'logs' será adicionado separadamente com push()
    };

    try {
        const newPedidoRef = db.ref('pedidos').push(); // Gera ID único no Firebase (-Mabc123...)
        const pedidoIdFirebase = newPedidoRef.key; // Guarda o ID gerado

        // Cria o log inicial
        const initialLog = { timestamp, user: currentUser.name, description: 'Pedido criado.', type: 'log' };
        // Adiciona o log inicial usando push() dentro do nó 'logs' do novo pedido
        await db.ref(`pedidos/${pedidoIdFirebase}/logs`).push(initialLog);

        // Define os dados principais do pedido (sem os logs, pois já foram adicionados via push)
        await newPedidoRef.set(pedidoData);

        showNotification(`Pedido #${pedidoNumero} criado com sucesso!`, 'success');
        if(pedidoModal) pedidoModal.classList.add('hidden'); // Fecha o modal
    } catch (error) {
        console.error("Erro ao salvar novo pedido no Firebase:", error);
        showNotification(`Erro ao salvar pedido: ${error.message}`, 'error');
        // Idealmente, reverteria o contador 'proximoPedido', mas é complexo.
    } finally {
         if(formButton) formButton.disabled = false; // Reabilita botão ao final
    }
};

const saveDetailsAndMaybeAdvance = async (advanceStatus = false) => {
    // Código completo da função saveDetailsAndMaybeAdvance
    const id = document.getElementById('logPedidoId')?.value;
     if (!id || !allPedidos[id]) {
         showNotification("Erro: ID do pedido inválido para salvar.", "error");
         return false; // Indica falha
     }
     const pedidoAtual = allPedidos[id];
     const saveButton = document.getElementById('saveAndNextStatusBtn');

     // Desabilita botão durante salvamento
     if(saveButton) saveButton.disabled = true;

     // Calcula o total baseado nos itens atualmente no modal (itensAdicionadosState)
     const valorTotalCalculado = calculateDetailsTotal(false); // Apenas calcula

     // Monta o objeto de atualizações para o Firebase
     const updates = {
        itens: itensAdicionadosState, // Salva o array de itens do estado do modal
        formaPagamento: document.getElementById('detailsFormaPagamento')?.value || pedidoAtual.formaPagamento,
        desconto: parseFloat(document.getElementById('detailsDesconto')?.value) || 0,
        valorTotal: valorTotalCalculado, // Salva o total calculado
        lastUpdate: new Date().toISOString() // Atualiza data da última modificação
        // Não atualiza 'observacoes' aqui. Use logs para histórico.
     };

     try {
        await db.ref(`pedidos/${id}`).update(updates); // Envia as atualizações para o Firebase

         let notificationMessage = 'Alterações salvas no pedido!';
         // Se a opção de avançar status foi marcada
         if (advanceStatus) {
            const currentStatusIndex = STATUS_LIST.indexOf(pedidoAtual.status);
            const nextStatus = currentStatusIndex < STATUS_LIST.length - 1 ? STATUS_LIST[currentStatusIndex + 1] : null;

            if (nextStatus) {
                // Chama a função que atualiza o status E adiciona o log de status
                await updatePedidoStatus(id, nextStatus);
                notificationMessage = 'Pedido salvo e status avançado!';
            } else {
                 notificationMessage = 'Pedido salvo! Já está no último status.';
            }
         }

         showNotification(notificationMessage, 'success'); // Notifica o usuário
        if(detailsModal) detailsModal.classList.add('hidden'); // Fecha o modal
        return true; // Indica sucesso

     } catch (error) {
         console.error("Erro ao salvar detalhes/avançar status:", error);
         showNotification(`Erro ao salvar: ${error.message}`, 'error');
         return false; // Indica falha
     } finally {
          // Reabilita o botão ao final
          if(saveButton) saveButton.disabled = false;
     }
};

const saveLogAndUploads = async (e) => {
    // Código completo da função saveLogAndUploads
   e.preventDefault(); // Impede envio padrão do formulário
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (!submitBtn) return; // Segurança

    const pedidoId = document.getElementById('logPedidoId')?.value;
    const descriptionInput = document.getElementById('logDescricao');
    const description = descriptionInput ? descriptionInput.value.trim() : '';

    // Validações
    if (!pedidoId) { showNotification("Erro: ID do pedido não encontrado.", "error"); return; }
    if (!description && filesToUpload.length === 0) { showNotification("Digite uma descrição ou selecione arquivos.", "warning"); return; }

    // Estado de carregamento
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin mr-2'></i> Salvando...`;

    const timestamp = new Date().toISOString();
    // Monta o objeto de log
    const logEntry = {
        timestamp: timestamp,
        user: currentUser.name, // Nome do usuário logado
        description: description || `Adicionou ${filesToUpload.length} mídia(s).`, // Descrição ou fallback
        type: 'log' // Tipo de registro
    };

    try {
        // 1. Salva o Log de Texto no Firebase
        // Usa push() para gerar um ID único para este log
        await db.ref(`pedidos/${pedidoId}/logs`).push(logEntry);

        // 2. Processa Uploads de Mídia (se houver)
        if (filesToUpload.length > 0) {
            submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin mr-2'></i> Enviando ${filesToUpload.length} mídia(s)...`;

            // Mapeia cada arquivo para uma promessa de upload + criação do objeto de mídia
            const uploadPromises = filesToUpload.map(async (file) => {
                const url = await uploadFileToCloudinary(file); // Faz upload para Cloudinary
                return { // Retorna o objeto a ser salvo no Firebase
                    type: file.type || 'application/octet-stream', // Tipo do arquivo
                    url: url, // URL segura retornada
                    name: file.name, // Nome original do arquivo
                    timestamp: timestamp // Timestamp do log associado
                };
            });

            // Espera todos os uploads terminarem
            const mediaResults = await Promise.all(uploadPromises);

            // 3. Salva as referências da mídia no Firebase
            const mediaRef = db.ref(`pedidos/${pedidoId}/media`);
            for (const result of mediaResults) {
               await mediaRef.push().set(result); // Adiciona cada mídia com push()
            }
        }

        // 4. Limpeza e Feedback de Sucesso
        if(logForm) logForm.reset(); // Limpa o formulário de log
        filesToUpload = []; // Limpa a fila de arquivos
        if(fileNameDisplay) fileNameDisplay.textContent = ''; // Limpa o display de nome de arquivo
        showNotification('Atualização adicionada com sucesso!', 'success');

    } catch (error) {
         // Erros de upload já mostram notificação dentro de uploadFileToCloudinary
         if (!error.message || !error.message.includes('upload')) { // Evita notificação duplicada
             showNotification(`Erro ao salvar atualização: ${error.message || 'Erro desconhecido'}`, 'error');
         }
         console.error("Erro completo em saveLogAndUploads:", error);
    } finally {
        // Restaura o botão, independentemente de sucesso ou falha
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class='bx bx-message-square-add mr-2'></i> Adicionar ao Histórico`;
    }
};


/* ==================================================================
MODAL DE DETALHES - Funções Internas (Reutilizadas da resposta anterior)
==================================================================
*/
const renderDetailsItems = () => {
    // Código completo da função renderDetailsItems
     const container = document.getElementById('detailsItensContainer');
    if (!container) {
        console.warn("Elemento detailsItensContainer não encontrado para renderizar itens.");
        return;
    }
    // Garante que itensAdicionadosState seja um array
    const itens = Array.isArray(itensAdicionadosState) ? itensAdicionadosState : [];

    if (itens.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm italic">Nenhum item adicionado a este pedido.</p>';
        return;
    }

    // Cria o HTML para cada item e junta
    container.innerHTML = itens.map((item, index) => `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded text-sm border border-gray-200 shadow-sm mb-1"> <span>${item.name || 'Item sem nome'} - ${formatCurrency(item.price)}</span>
          <button type="button" class="remove-item-btn text-red-500 hover:text-red-700 font-bold px-2 text-lg leading-none" data-index="${index}" title="Remover Item">&times;</button>
        </div>`).join('');
};
const calculateDetailsTotal = (saveToDB = false) => {
    // Código completo da função calculateDetailsTotal
     // Garante que itensAdicionadosState seja um array
     const itens = Array.isArray(itensAdicionadosState) ? itensAdicionadosState : [];
     const itensTotal = itens.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

    const descontoInput = document.getElementById('detailsDesconto');
    const desconto = parseFloat(descontoInput ? descontoInput.value : 0) || 0;
    const total = Math.max(0, itensTotal - desconto); // Evita total negativo

    const totalDisplay = document.getElementById('detailsValorTotalDisplay');
    if(totalDisplay) totalDisplay.textContent = formatCurrency(total);

    // Atualiza no Firebase somente se saveToDB for true E o valor mudou
    if (saveToDB) {
        const id = document.getElementById('logPedidoId')?.value;
        if (id && allPedidos[id]) {
             const valorAtualDB = allPedidos[id].valorTotal;
             // Compara valores formatados para evitar problemas com ponto flutuante
             if (formatCurrency(valorAtualDB) !== formatCurrency(total)) {
                 console.log(`Atualizando valorTotal no DB para pedido ${id}: ${formatCurrency(total)}`);
                db.ref(`pedidos/${id}/valorTotal`).set(total).catch(error => {
                   console.error("Erro ao salvar valor total no DB:", error);
                   showNotification("Erro ao atualizar total no banco de dados.", "error");
                });
             }
        }
    }
     return total; // Retorna o valor numérico calculado
};
const renderTimeline = (pedido) => {
    // Código completo da função renderTimeline
   const timelineContainer = document.getElementById('timelineContainer');
    if (!timelineContainer) {
        console.warn("Elemento timelineContainer não encontrado.");
        return;
    }

    // Converte objeto de logs em array, adiciona ID (key) e ordena (mais recente primeiro)
    const logs = pedido.logs ? Object.entries(pedido.logs)
                                .map(([key, value]) => ({ ...value, id: key })) // Adiciona a key do Firebase como 'id'
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Ordena por data descendente
                             : [];

    if (logs.length === 0) {
      timelineContainer.innerHTML = '<p class="text-gray-500 text-center py-4 text-sm italic">Nenhum histórico registrado para este pedido.</p>';
      return;
    }

    // Cria o HTML para cada entrada de log
    timelineContainer.innerHTML = logs.map(log => {
         const iconClass = log.type === 'status' ? 'bx-transfer' : 'bx-message-detail';
         const iconColor = log.type === 'status' ? 'text-green-600 border-green-500' : 'text-blue-600 border-blue-500';
         const userDisplay = log.user || 'Sistema'; // Nome do usuário ou 'Sistema'

         return `
            <div class="timeline-item ${log.type === 'status' ? 'timeline-item-status' : 'timeline-item-log'}">
              {/* Ícone da Timeline */}
              <div class="timeline-icon ${iconColor}"><i class='bx ${iconClass}'></i></div>
              {/* Conteúdo do Log */}
              <div class="bg-white p-3 rounded-lg shadow-sm border border-gray-200 ml-2 relative"> {/* Adicionado relative para botão excluir */}
                <div class="flex justify-between items-start mb-1 gap-2">
                  <h4 class="font-semibold text-gray-700 text-sm flex-grow">${userDisplay}</h4>
                  <span class="text-xs text-gray-500 flex-shrink-0">${formatDateTime(log.timestamp)}</span>
                </div>
                <p class="text-gray-600 text-sm break-words">${log.description || '(Sem descrição)'}</p> {/* break-words para quebrar texto longo */}

                {/* Botão Excluir Log (Opcional, adicione se necessário) */}
                {/*
                <button class="delete-log-btn absolute top-1 right-1 p-1 text-gray-400 hover:text-red-600" data-pedido-id="${pedido.id}" data-log-id="${log.id}" title="Excluir Log">
                    <i class='bx bx-x bx-xs'></i>
                </button>
                */}
              </div>
            </div>`;
    }).join('');
};
const renderMediaGallery = (pedido) => {
    // Código completo da função renderMediaGallery
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    if(!thumbnailGrid) { console.warn("Elemento thumbnail-grid não encontrado."); return; }

    const media = pedido.media || {};
    const mediaEntries = Object.entries(media).map(([key, item]) => ({ ...item, key: key }));
    // Opcional: Ordenar mídia, por exemplo, por timestamp se disponível
    // mediaEntries.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    lightboxMedia = mediaEntries; // Atualiza a lista para o lightbox

    if (mediaEntries.length === 0) {
      thumbnailGrid.innerHTML = `<div class="col-span-full text-center py-6 text-gray-400"><i class='bx bx-image bx-sm mb-2'></i><p class="text-xs italic">Nenhuma mídia adicionada</p></div>`;
      return;
    }

    thumbnailGrid.innerHTML = mediaEntries.map((item, index) => {
        if (!item || !item.url) return ''; // Pula item inválido

        // Verifica permissão para excluir (somente gestor)
        const canDelete = currentUser && currentUser.role && currentUser.role.toLowerCase().includes('gestor');
        const deleteButtonHTML = canDelete
            ? `<button class="delete-media-btn z-10" data-pedido-id="${pedido.id}" data-media-key="${item.key}" title="Excluir Mídia"><i class='bx bxs-trash bx-xs'></i></button>`
            : '';

        const fileType = item.type || '';
        const isImage = fileType.startsWith('image/');
        const isVideo = fileType.startsWith('video/');
        const isPdf = fileType === 'application/pdf';
        const fileName = item.name || `Arquivo_${index + 1}`; // Nome fallback

        let thumbnailContent;
        // Cria o conteúdo da miniatura baseado no tipo de arquivo
        if (isImage) {
            thumbnailContent = `<img src="${item.url}" alt="${fileName}" loading="lazy" class="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-105">`; // Efeito de zoom no hover
        } else if (isVideo) {
            thumbnailContent = `<div class="flex flex-col items-center justify-center h-full p-1 text-center"><i class='bx bx-play-circle text-3xl text-blue-500'></i><span class="text-xs text-gray-600 mt-1 truncate w-full px-1" title="${fileName}">${fileName}</span></div>`;
        } else if (isPdf) {
            thumbnailContent = `<div class="flex flex-col items-center justify-center h-full p-1 text-center"><i class='bx bxs-file-pdf text-3xl text-red-500'></i><span class="text-xs text-gray-600 mt-1 truncate w-full px-1" title="${fileName}">${fileName}</span></div>`;
        } else {
             thumbnailContent = `<div class="flex flex-col items-center justify-center h-full p-1 text-center"><i class='bx bx-file text-3xl text-gray-400'></i><span class="text-xs text-gray-500 mt-1 truncate w-full px-1" title="${fileName}">${fileName}</span></div>`;
        }

        // Monta o HTML do container da miniatura
        return `
            <div class="thumbnail-container group bg-gray-100 rounded-md overflow-hidden flex items-center justify-center relative border border-gray-300 hover:shadow-lg transition-shadow aspect-square"> {/* group para hover effect */}
                ${deleteButtonHTML} {/* Botão excluir (se permitido) */}
                <div class="thumbnail-item w-full h-full cursor-pointer flex items-center justify-center relative" data-index="${index}"> {/* Área clicável */}
                    ${thumbnailContent} {/* Conteúdo da miniatura */}
                </div>
            </div>`;
    }).join(''); // Junta todos os HTMLs das miniaturas
};
const openLightbox = (index) => {
    // Código completo da função openLightbox
    if (!lightboxMedia || index < 0 || index >= lightboxMedia.length) {
        console.warn("Índice do lightbox inválido:", index);
        return;
    }
    currentLightboxIndex = index;
    const media = lightboxMedia[index];

    if (!media || !media.url) {
        console.warn("Mídia inválida ou sem URL no índice:", index, media);
        showNotification("Não foi possível abrir esta mídia.", "error");
        return;
    }

    const lightboxContent = document.getElementById('lightbox-content');
    if(!lightboxContent) { console.error("Elemento lightbox-content não encontrado."); return; }

    // Limpa conteúdo e mostra carregando
    lightboxContent.innerHTML = '<p class="text-white animate-pulse text-center">Carregando mídia...</p>';

    // Cria o elemento apropriado (img, video, ou link)
    if (media.type === 'application/pdf') {
         lightboxContent.innerHTML = `<div class="text-center p-6 bg-gray-800 rounded">
                                        <i class='bx bxs-file-pdf text-6xl text-red-400 mb-4'></i>
                                        <p class="text-gray-300 text-sm mb-4 break-all">${media.name || 'Documento PDF'}</p>
                                        <a href="${media.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded hover:bg-red-700 transition-colors">
                                           <i class='bx bx-link-external'></i>Abrir PDF em Nova Aba
                                        </a>
                                      </div>`;
    } else if (media.type && media.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => { lightboxContent.innerHTML = ''; lightboxContent.appendChild(img); }; // Adiciona só depois de carregar
        img.onerror = () => { lightboxContent.innerHTML = '<p class="text-red-400 text-center">Erro ao carregar imagem.</p>'; };
        img.src = media.url;
        img.alt = media.name || 'Imagem';
        img.className = "block max-w-full max-h-full object-contain rounded shadow-lg";
    } else if (media.type && media.type.startsWith('video/')) {
      lightboxContent.innerHTML = `<video src="${media.url}" controls controlsList="nodownload" class="block max-w-full max-h-full rounded shadow-lg"></video>`; // nodownload opcional
    } else {
       // Link genérico para outros tipos de arquivo
       lightboxContent.innerHTML = `<div class="text-center p-6 bg-gray-800 rounded">
                                       <i class='bx bx-file text-6xl text-gray-400 mb-4'></i>
                                       <p class="text-gray-300 text-sm mb-4 break-all">${media.name || 'Arquivo'}</p>
                                       <a href="${media.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 transition-colors">
                                          <i class='bx bx-download'></i>Baixar / Abrir Arquivo
                                       </a>
                                     </div>`;
    }

     // Mostra o lightbox
     if(lightbox){
        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
     }
};


/* ==================================================================
MODAL DE CONFIGURAÇÃO - Funções
==================================================================
*/
const openConfigModal = () => {
    // Código completo da função openConfigModal
    renderConfigLists(); // Atualiza a lista de produtos antes de mostrar
     if(configModal){
        configModal.classList.remove('hidden'); // Remove a classe que esconde
        configModal.classList.add('flex'); // Adiciona classe que mostra (usando flexbox para centralizar)
     } else {
         console.error("Modal de configuração não encontrado no DOM.");
     }
};
const renderConfigLists = () => {
    // Código completo da função renderConfigLists
   const servicosListContainer = document.getElementById('configServicosList');
    if (!servicosListContainer) {
        console.warn("Elemento configServicosList não encontrado para renderizar produtos.");
        return;
    }
    // Garante que configData.produtos é um array, mesmo que vazio
    const produtos = Array.isArray(configData.produtos) ? configData.produtos : [];

     if (produtos.length === 0) {
         servicosListContainer.innerHTML = '<p class="text-gray-500 text-sm text-center italic p-4">Nenhum produto cadastrado no momento.</p>';
         return;
     }
     // Ordena os produtos alfabeticamente pelo nome para melhor visualização
     produtos.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Cria o HTML para cada produto na lista
    servicosListContainer.innerHTML = produtos.map((p, i) => `
      <div class="flex justify-between items-center bg-white p-3 rounded border border-gray-200 shadow-sm mb-2 transition-colors hover:bg-gray-50">
        <span class="text-sm text-gray-800 flex-grow mr-2">${p.name} - ${formatCurrency(p.price)}</span>
        <button class="remove-servico-btn text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 text-xl leading-none flex-shrink-0" data-index="${i}" title="Excluir Produto">&times;</button>
      </div>`).join(''); // Junta todos os elementos HTML
};
const addProdutoConfig = async (e) => {
    // Código completo da função addProdutoConfig
    e.preventDefault(); // Impede o envio padrão do formulário
    const nameInput = document.getElementById('newServicoName');
    const priceInput = document.getElementById('newServicoPrice');
    const addButton = e.target.querySelector('button[type="submit"]');

    const name = nameInput ? nameInput.value.trim() : '';
    const price = priceInput ? parseFloat(priceInput.value) : 0;

    // Validações
    if (!name) { showNotification("O nome do produto é obrigatório.", "error"); return; }
    if (isNaN(price) || price <= 0) { showNotification("O preço deve ser um número maior que zero.", "error"); return; }

    // Garante que configData.produtos seja um array
    if (!Array.isArray(configData.produtos)) configData.produtos = [];

    // Verifica duplicidade (ignorando maiúsculas/minúsculas)
    const exists = configData.produtos.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        showNotification(`O produto "${name}" já existe no catálogo.`, "error");
        return;
    }

    // Desabilita botão durante o processo
    if(addButton) addButton.disabled = true;

    // Adiciona o novo produto à lista local (tentativa)
    const newProduct = { name, price };
    const tentativeProductList = [...configData.produtos, newProduct];

    try {
        // Tenta salvar a lista COMPLETA (incluindo o novo) no Firebase
        await db.ref('config/produtos').set(tentativeProductList);

        // Se SUCESSO no Firebase:
        configData.produtos = tentativeProductList; // Confirma a adição no estado local
        renderConfigLists(); // Atualiza a interface do modal
        if(nameInput) nameInput.value = ''; // Limpa os campos do formulário
        if(priceInput) priceInput.value = '';
        showNotification(`"${name}" foi adicionado ao catálogo!`, "success");

    } catch (error) {
        console.error("Erro ao salvar novo produto na configuração:", error);
        showNotification("Erro ao salvar o produto no banco de dados. Tente novamente.", "error");
        // Não precisa reverter localmente, pois `tentativeProductList` não foi atribuído a `configData.produtos`
    } finally {
         // Reabilita o botão ao final
         if(addButton) addButton.disabled = false;
    }
};
const removeProdutoConfig = async (e) => {
    // Código completo da função removeProdutoConfig
    // Verifica se o clique foi no botão de remover (usando a classe)
    if (e.target.classList.contains('remove-servico-btn')) {
        const index = parseInt(e.target.dataset.index); // Pega o índice do produto a remover

        // Validações
        if (isNaN(index) || !configData.produtos || index < 0 || index >= configData.produtos.length) {
            console.warn("Índice inválido ou lista de produtos não encontrada para remoção.");
            return;
        }

        const produtoParaRemover = configData.produtos[index]; // Guarda os dados do produto

        // Confirmação com o usuário
        if (confirm(`Tem certeza que deseja remover o produto "${produtoParaRemover.name}" do catálogo?`)) {
            // Cria uma NOVA lista sem o produto a ser removido
            const produtosAtualizados = configData.produtos.filter((_, i) => i !== index);

            // Desabilita o botão clicado (feedback visual)
            e.target.disabled = true;

            try {
                // Tenta salvar a NOVA lista (sem o produto) no Firebase
                await db.ref('config/produtos').set(produtosAtualizados);

                // Se SUCESSO no Firebase:
                configData.produtos = produtosAtualizados; // Atualiza o estado local
                renderConfigLists(); // Re-renderiza a lista no modal
                showNotification(`"${produtoParaRemover.name}" foi removido.`, "success");

            } catch (error) {
                 console.error("Erro ao remover produto da configuração:", error);
                 showNotification("Erro ao remover o produto. Tente novamente.", "error");
                 // Reabilita o botão se falhar
                 e.target.disabled = false;
                 // Não reverte o estado local para evitar inconsistências se o usuário tentar de novo
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
    if(!globalSearchInput || !globalSearchResults) {
        console.warn("Elementos de busca não encontrados.");
        return;
    }

    const searchTerm = globalSearchInput.value.toLowerCase().trim(); // Termo de busca em minúsculas

     // Se a busca está vazia, limpa e esconde os resultados
     if (!searchTerm) {
         globalSearchResults.innerHTML = '';
         globalSearchResults.classList.add('hidden');
         return;
     }

     // Filtra os pedidos do estado local 'allPedidos'
    const results = Object.values(allPedidos).filter(pedido => {
        // Combina várias verificações em uma única condição
        return (pedido.clienteNome && pedido.clienteNome.toLowerCase().includes(searchTerm)) ||
               (pedido.pedidoNumero && String(pedido.pedidoNumero).includes(searchTerm)) ||
               (pedido.id && pedido.id.toLowerCase().includes(searchTerm.replace('#',''))) || // Busca por ID Firebase
               // Opcional: buscar nos itens do pedido
               (Array.isArray(pedido.itens) && pedido.itens.some(item => item.name && item.name.toLowerCase().includes(searchTerm))) ||
               // Opcional: buscar no nome do vendedor
               (pedido.vendedorResponsavel && pedido.vendedorResponsavel.toLowerCase().includes(searchTerm));
    })
    .sort((a,b) => new Date(b.lastUpdate || b.createdAt || 0) - new Date(a.lastUpdate || a.createdAt || 0)) // Ordena por última atualização ou criação (mais recente primeiro)
    .slice(0, 10); // Limita o número de resultados exibidos

     // Exibe os resultados ou mensagem de "não encontrado"
     if (results.length > 0) {
         globalSearchResults.innerHTML = results.map(pedido => `
             <div class="search-result-item p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 transition-colors" data-id="${pedido.id}">
                 <p class="font-semibold text-sm text-gray-800 truncate">${pedido.clienteNome || 'Cliente Desconhecido'} (#${pedido.pedidoNumero || pedido.id.slice(-5)})</p>
                 <p class="text-xs text-gray-500">${pedido.vendedorResponsavel || 'N/A'} - <span class="font-medium ${pedido.status === 'Entregue' ? 'text-green-600' : 'text-blue-600'}">${formatStatus(pedido.status)}</span></p>
             </div>
         `).join('');
         globalSearchResults.classList.remove('hidden'); // Mostra a lista
     } else {
         globalSearchResults.innerHTML = '<p class="p-3 text-center text-sm text-gray-500 italic">Nenhum pedido correspondente encontrado.</p>';
         globalSearchResults.classList.remove('hidden'); // Mostra a mensagem
     }
};


/* ==================================================================
CONFIGURAÇÃO DOS LISTENERS DE EVENTOS GERAIS
==================================================================
*/
// ESTA É A FUNÇÃO COMPLETA, SEM ABREVIAÇÕES
const setupEventListeners = () => {
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
            try { db.ref('pedidos').off(); console.log("Listener 'pedidos' desligado."); }
            catch(e) { console.warn("Erro ao tentar desligar listener 'pedidos':", e); }
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
