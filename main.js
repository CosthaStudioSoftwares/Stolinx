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
let auth, db, functions, currentUserId;
let firestoreUnsubscribes = [];

// --- SHARED FUNCTIONS ---

function showAppNotification(message, title = 'Aviso') {
    const modal = document.getElementById('app-notification-modal');
    if (!modal) return;
    document.getElementById('app-notification-title').textContent = title;
    document.getElementById('app-notification-message').textContent = message;
    const buttons = document.getElementById('app-notification-buttons');
    buttons.innerHTML = '<button id="notification-ok-btn" class="btn-success">OK</button>';
    modal.style.display = 'flex';
    document.getElementById('notification-ok-btn').addEventListener('click', () => modal.style.display = 'none');
}

function showAppConfirmation(message, onConfirm, title = 'Confirmação') {
    const modal = document.getElementById('app-notification-modal');
     if (!modal) return;
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
    if (!currentUserId) throw new Error("Usuário não está logado!");
    return db.collection('users').doc(currentUserId).collection(collectionName);
}

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
            
            // Lógica para verificar a assinatura ANTES de mostrar a página
            const userRef = db.collection('users').doc(user.uid);
            userRef.get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const now = new Date();
                    const isSubscriptionActive = userData.active && userData.expiresAt && userData.expiresAt.toDate() > now;
                    
                    // Permite acesso ao dashboard mesmo se a assinatura expirou, para que o usuário possa renovar
                    if (isSubscriptionActive || config.page === 'dashboard') {
                        const container = document.querySelector('.container');
                        if(container) {
                            container.classList.add('visible');
                        }
                        setupCommonUI(user);
                        if (config.init && typeof config.init === 'function') {
                            config.init();
                        }
                    } else {
                        // Se a assinatura estiver expirada e ele tentar acessar outra página, redireciona para o dashboard
                        alert('Sua assinatura expirou. Renove para acessar esta funcionalidade.');
                        window.location.href = 'dashboard.html';
                    }
                } else {
                     window.location.href = 'index.html';
                }
            });
        } else {
            // Se não houver usuário logado, redireciona para a página de login
            // A menos que a página atual já seja a de login (para evitar loop)
            if (config.page !== 'login') {
                window.location.href = 'index.html';
            }
        }
    });
}

function setupCommonUI(user) {
    try {
        const menuBtn = document.getElementById('menu-btn');
        const closeBtn = document.getElementById('close-btn');
        const aside = document.querySelector('aside');
        if(menuBtn) menuBtn.addEventListener('click', () => aside.classList.add('show-sidebar'));
        if(closeBtn) closeBtn.addEventListener('click', () => aside.classList.remove('show-sidebar'));

        const themeTogglerLink = document.getElementById('theme-toggler-link');
        if (themeTogglerLink) {
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
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                firestoreUnsubscribes.forEach(unsubscribe => unsubscribe());
                firestoreUnsubscribes = [];
                auth.signOut();
            });
        }

        const welcomeMessageEl = document.getElementById('welcome-message');
        if (welcomeMessageEl) {
            let userName = user.displayName || user.email.split('@')[0];
            userName = userName.charAt(0).toUpperCase() + userName.slice(1);
            welcomeMessageEl.textContent = `Olá, ${userName}`;
        }
        
        const notificationModal = document.getElementById('app-notification-modal');
        if(notificationModal) {
            const closeBtn = document.getElementById('app-notification-close-btn');
            if(closeBtn) closeBtn.addEventListener('click', () => notificationModal.style.display = 'none');
            notificationModal.addEventListener('click', (e) => {
                if (e.target === notificationModal) notificationModal.style.display = 'none';
            });
        }
    } catch (error) {
        console.error("Erro ao configurar a UI comum:", error);
    }
}

