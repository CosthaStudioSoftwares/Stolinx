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
 * Shows a generic notification modal.
 * @param {string} message The message to display.
 * @param {string} title The title of the modal.
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
 * Shows a confirmation modal with confirm/cancel buttons.
 * @param {string} message The confirmation message.
 * @param {function} onConfirm The function to execute on confirmation.
 * @param {string} title The title of the modal.
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
 * Formats a number input as Brazilian currency.
 * @param {HTMLInputElement} input The input element.
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
 * Returns a reference to a user-specific Firestore collection.
 * @param {string} collectionName The name of the collection.
 * @returns {firebase.firestore.CollectionReference}
 */
function getUserCollection(collectionName) {
    if (!currentUserId) throw new Error("User not logged in!");
    return db.collection('users').doc(currentUserId).collection(collectionName);
}


/**
 * Main initialization function for authenticated pages.
 * @param {object} config Configuration object for the page.
 * @param {string} config.page The name of the current page (e.g., 'dashboard').
 * @param {function} config.init The page-specific initialization function.
 */
function initializeApp(config) {
    // --- Initialize Firebase ---
    let app; // Precisamos da variável 'app'
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
    } else {
        app = firebase.app(); // Pega a app já inicializada
    }
    
    // =======================================================
    // ==============    ALTERAÇÃO 1: APP CHECK    ===============
    // =======================================================
    // IMPORTANTE: Substitua A_SUA_CHAVE_DO_SITE_AQUI pela sua chave do reCAPTCHA
    const appCheck = firebase.appCheck();
    appCheck.activate(
        '6LfxJ9YrAAAAAHldTMTw7pMA2PPiETNIh_VviK8V',
        true
    );


    auth = firebase.auth();
    db = firebase.firestore();

    // --- Authentication Check ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            const userRef = db.collection('users').doc(user.uid);

            userRef.get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const now = new Date();
                    
                    // =======================================================
                    // ===   ALTERAÇÃO 2: CORREÇÃO DO REDIRECIONAMENTO   ===
                    // =======================================================
                    // Independentemente de a subscrição estar ativa ou não, o utilizador vai para o dashboard.
                    if (userData.active && userData.expiresAt && userData.expiresAt.toDate() > now) {
                        // Utilizador está ativo e pode ficar, executa a lógica da página
                        setupCommonUI(user);
                        if (config.init && typeof config.init === 'function') {
                            config.init();
                        }
                    } else {
                        // A subscrição expirou ou não está ativa, mas a página é o dashboard, então está OK.
                        // Se a página não for o dashboard, redireciona para lá.
                        if (config.page !== 'dashboard') {
                           window.location.href = 'dashboard.html';
                        } else {
                           // Já está no dashboard, pode continuar e ver a mensagem de renovação.
                           setupCommonUI(user);
                           if (config.init && typeof config.init === 'function') {
                                config.init();
                           }
                        }
                    }
                } else {
                    // Não deveria acontecer se o utilizador estiver logado, mas como um fallback...
                    window.location.href = 'index.html';
                }
            });
        } else {
            // Utilizador não está logado
            window.location.href = 'index.html';
        }
    });
}

/**
 * Sets up common UI elements like sidebar, theme, and logout.
 * @param {firebase.User} user The authenticated user object.
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
    
    // Define o ícone correto na hora que a página carrega, evitando a "piscada"
    if (document.documentElement.classList.contains('dark-theme')) {
        themeTogglerLink.querySelector('span').textContent = 'dark_mode';
    }

    // Adiciona o evento de clique para alternar o tema
    themeTogglerLink.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Alterna a classe na tag <html>, que é o lugar correto agora
        document.documentElement.classList.toggle('dark-theme');
        
        // Verifica qual é o novo estado do tema (claro ou escuro)
        const isDark = document.documentElement.classList.contains('dark-theme');

        // Atualiza o ícone e salva a preferência no localStorage
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
