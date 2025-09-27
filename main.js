// --- GLOBAL CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyAv54tgJ5oYrwTSNXpB2rCGjNbhJhe2CoM",
    authDomain: "stolinx-d6e26.firebaseapp.com",
    projectId: "stolinx-d6e26",
    storageBucket: "stolinx-d6e26.appspot.com",
    messagingSenderId: "715535971682",
    appId: "1:715535971682:web:66620d1590ae3e4ba6a83b"
};

// --- GLOBAL VARIABLES ---
let auth, db, currentUserId;
let firestoreUnsubscribes = [];

// --- SHARED FUNCTIONS ---

/**
 * Mostra um modal de notificação genérico.
 * @param {string} message A mensagem a ser exibida.
 * @param {string} title O título do modal.
 */
function showAppNotification(message, title = 'Aviso') {
    const modal = document.getElementById('app-notification-modal');
    document.getElementById('app-notification-title').textContent = title;
    document.getElementById('app-notification-message').textContent = message;
    const buttons = document.getElementById('app-notification-buttons');
    buttons.innerHTML = '<button id="notification-ok-btn" class="btn-success">OK</button>';
    modal.style.display = 'flex';
    document.getElementById('notification-ok-btn').addEventListener('click', () => modal.style.display = 'none');
}

/**
 * Mostra um modal de confirmação com botões de confirmar/cancelar.
 * @param {string} message A mensagem de confirmação.
 * @param {function} onConfirm A função a ser executada na confirmação.
 * @param {string} title O título do modal.
 */
function showAppConfirmation(message, onConfirm, title = 'Confirmação') {
    const modal = document.getElementById('app-notification-modal');
    document.getElementById('app-notification-title').textContent = title;
    document.getElementById('app-notification-message').textContent = message;
    const buttons = document.getElementById('app-notification-buttons');
    buttons.innerHTML = `
        <button id="confirmation-cancel-btn">Cancelar</button>
        <button id="confirmation-ok-btn" class="btn-danger">Confirmar</button>
    `;
    modal.style.display = 'flex';
    document.getElementById('confirmation-ok-btn').addEventListener('click', () => {
        if (typeof onConfirm === 'function') onConfirm();
        modal.style.display = 'none';
    });
    document.getElementById('confirmation-cancel-btn').addEventListener('click', () => modal.style.display = 'none');
}

/**
 * Formata um campo de input como moeda brasileira.
 * @param {HTMLInputElement} input O elemento de input.
 */
function formatCurrency(input) {
    let value = input.value.replace(/\D/g, '');
    if (value === "") {
        input.value = "";
        return;
    }
    value = (parseInt(value, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    input.value = value;
}


/**
 * Retorna uma referência a uma coleção do Firestore específica do usuário.
 * @param {string} collectionName O nome da coleção.
 * @returns {firebase.firestore.CollectionReference}
 */
function getUserCollection(collectionName) {
    if (!currentUserId) throw new Error("Usuário não está logado!");
    return db.collection('users').doc(currentUserId).collection(collectionName);
}


/**
 * Função principal de inicialização para páginas autenticadas.
 * @param {object} config Objeto de configuração para a página.
 * @param {string} config.page O nome da página atual (ex: 'dashboard').
 * @param {function} config.init A função de inicialização específica da página.
 */
function initializeApp(config) {
    // --- Initialize Firebase ---
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();

    // ALTERAÇÃO: Inicializa o App Check para garantir que as chamadas para as Functions sejam autenticadas
    const appCheck = firebase.appCheck();
    appCheck.activate(
        '6LfxJ9YrAAAAAHldTMTw7pMA2PPiETNIh_VviK8V', // Sua chave do reCAPTCHA v3
        true);


    // --- Authentication Check ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            const userRef = db.collection('users').doc(user.uid);

            userRef.get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const now = new Date();
                    const isSubscriptionActive = userData.active && userData.expiresAt && userData.expiresAt.toDate() > now;
                    
                    // ALTERAÇÃO: Lógica de redirecionamento ajustada.
                    // Permite que o usuário acesse o dashboard mesmo com a assinatura expirada para que ele possa renovar.
                    // Se a assinatura estiver expirada e ele tentar acessar outra página, será redirecionado para o dashboard.
                    if (isSubscriptionActive || config.page === 'dashboard') {
                        // Usuário pode continuar para a página solicitada
                        setupCommonUI(user);
                        if (config.init && typeof config.init === 'function') {
                            config.init();
                        }
                    } else {
                        // Assinatura expirada e tentando acessar uma página protegida
                        // Mostra um aviso e redireciona para o dashboard
                        showAppNotification('Sua assinatura expirou. Renove para acessar esta funcionalidade.', 'Aviso');
                        setTimeout(() => {
                           window.location.href = 'dashboard.html';
                        }, 3000); // Espera 3s para o usuário ler a mensagem
                    }
                } else {
                    // Fallback: se o documento do usuário não existir, redireciona para o login
                    window.location.href = 'index.html';
                }
            });
        } else {
            // Usuário não está logado
            window.location.href = 'index.html';
        }
    });
}

/**
 * Configura elementos de UI comuns como a barra lateral, tema e logout.
 * @param {firebase.User} user O objeto do usuário autenticado.
 */
function setupCommonUI(user) {
    // --- Sidebar and Menu ---
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const aside = document.querySelector('aside');
    if(menuBtn) menuBtn.addEventListener('click', () => aside.classList.add('show-sidebar'));
    if(closeBtn) closeBtn.addEventListener('click', () => aside.classList.remove('show-sidebar'));

    // --- Theme Toggler ---
    const themeTogglerLink = document.getElementById('theme-toggler-link');
    
    if (document.documentElement.classList.contains('dark-theme')) {
        themeTogglerLink.querySelector('span').textContent = 'dark_mode';
    }

    themeTogglerLink.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.documentElement.classList.toggle('dark-theme');
        
        const isDark = document.documentElement.classList.contains('dark-theme');

        themeTogglerLink.querySelector('span').textContent = isDark ? 'dark_mode' : 'light_mode';
        localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    });

    // --- Logout ---
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        firestoreUnsubscribes.forEach(unsubscribe => unsubscribe());
        firestoreUnsubscribes = [];
        auth.signOut();
    });

    // --- Welcome Message ---
    const welcomeMessageEl = document.getElementById('welcome-message');
    if (welcomeMessageEl) {
        let userName = user.displayName || user.email.split('@')[0];
        userName = userName.charAt(0).toUpperCase() + userName.slice(1);
        welcomeMessageEl.textContent = `Olá, ${userName}`;
    }
    
    // --- Modal Closing ---
    const notificationModal = document.getElementById('app-notification-modal');
    if(notificationModal) {
        document.getElementById('app-notification-close-btn').addEventListener('click', () => notificationModal.style.display = 'none');
        notificationModal.addEventListener('click', (e) => {
            if (e.target === notificationModal) {
                notificationModal.style.display = 'none';
            }
        });
    }
}
