// --- CONFIGURAÇÃO GLOBAL DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAv54tgJ5oYrwTSNXpB2rCGjNbhJhe2CoM",
    authDomain: "stolinx-d6e26.firebaseapp.com",
    projectId: "stolinx-d6e26",
    storageBucket: "stolinx-d6e26.appspot.com",
    messagingSenderId: "715535971682",
    appId: "1:715535971682:web:66620d1590ae3e4ba6a83b"
};

// --- VARIÁVEIS GLOBAIS ---
let auth, db, functions, currentUserId;
let firestoreUnsubscribes = [];

// --- FUNÇÕES COMPARTILHADAS ---

function showAppNotification(message, title = 'Aviso') {
    const modal = document.getElementById('app-notification-modal');
    document.getElementById('app-notification-title').textContent = title;
    document.getElementById('app-notification-message').textContent = message;
    const buttons = document.getElementById('app-notification-buttons');
    buttons.innerHTML = '<button id="notification-ok-btn" class="btn-success">OK</button>';
    modal.style.display = 'flex';
    document.getElementById('notification-ok-btn').addEventListener('click', () => modal.style.display = 'none');
}

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

function formatCurrency(input) {
    let value = input.value.replace(/\D/g, '');
    if (value === "") {
        input.value = "";
        return;
    }
    value = (parseInt(value, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    input.value = value;
}

function getUserCollection(collectionName) {
    if (!currentUserId) throw new Error("Usuário não logado!");
    return db.collection('users').doc(currentUserId).collection(collectionName);
}

// --- FUNÇÃO DE INICIALIZAÇÃO PRINCIPAL ---
function initializeApp(config) {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    functions = firebase.functions();
    
    const appCheck = firebase.appCheck();
    appCheck.activate('6LfxJ9YrAAAAAHldTMTw7pMA2PPiETNIh_VviK8V', true);

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            // Mostra o container principal do app
            const container = document.querySelector('.container');
            if(container) container.style.display = 'grid';
            
            setupCommonUI(user);
            
            if (config && config.init && typeof config.init === 'function') {
                config.init();
            }
        } else {
            // Se não for a página de login, redireciona para lá
            if (config && config.page !== 'login') {
                window.location.href = 'index.html';
            }
        }
    });
}

function setupCommonUI(user) {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const aside = document.querySelector('aside');

    if(menuBtn) menuBtn.addEventListener('click', () => {
        if(aside) aside.style.left = '0';
    });
    if(closeBtn) closeBtn.addEventListener('click', () => {
        if(aside) aside.style.left = '-100%';
    });

    const themeTogglerLink = document.getElementById('theme-toggler-link');
    if(themeTogglerLink) {
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
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if(typeof firestoreUnsubscribes !== 'undefined') {
                firestoreUnsubscribes.forEach(unsubscribe => unsubscribe());
            }
            auth.signOut();
        });
    }

    const welcomeMsg = document.getElementById('welcome-message');
    if(welcomeMsg){
        let userName = user.displayName || user.email.split('@')[0];
        welcomeMsg.textContent = `Olá, ${userName.charAt(0).toUpperCase() + userName.slice(1)}`;
    }
    
    const notificationModal = document.getElementById('app-notification-modal');
    if(notificationModal) {
        const closeBtn = document.getElementById('app-notification-close-btn');
        if(closeBtn) closeBtn.addEventListener('click', () => notificationModal.style.display = 'none');
        notificationModal.addEventListener('click', e => { if (e.target === notificationModal) notificationModal.style.display = 'none'; });
    }
}

