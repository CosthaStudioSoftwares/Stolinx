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
    if (!currentUserId) throw new Error("User not logged in!");
    return db.collection('users').doc(currentUserId).collection(collectionName);
}

/**
 * LÓGICA DE INICIALIZAÇÃO CORRIGIDA
 * Garante a criação do Trial de 30 dias antes de verificar a ativação.
 */
function initializeApp(config) {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            const userRef = db.collection('users').doc(user.uid);

            try {
                // 1. Verificar se o e-mail foi verificado primeiro
                if (!user.emailVerified) {
                    showAppNotification("Por favor, verifique seu e-mail para ativar sua conta. Verifique sua caixa de entrada ou spam.", "E-mail não verificado");
                    return;
                }

                // 2. Tentar buscar o documento do usuário de forma assíncrona
                let doc = await userRef.get();

                // 3. Se o documento não existe (Novo Usuário), criamos o Trial AGORA
                if (!doc.exists) {
                    const now = new Date();
                    const trialEndDate = new Date();
                    trialEndDate.setDate(now.getDate() + 30);

                    const newUserProfile = {
                        email: user.email,
                        active: true,
                        trialUsed: true,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        expiresAt: firebase.firestore.Timestamp.fromDate(trialEndDate)
                    };

                    await userRef.set(newUserProfile);
                    console.log("Teste gratuito de 30 dias ativado no banco de dados.");
                    
                    // Atualizamos a variável 'doc' para prosseguir com os dados novos
                    doc = await userRef.get();
                }

                // 4. Validar os dados de acesso
                const userData = doc.data();
                const now = new Date();

                if (userData.active && userData.expiresAt && userData.expiresAt.toDate() > now) {
                    // Acesso permitido
                    setupCommonUI(user);
                    if (config.init) config.init();
                } else {
                    // Assinatura expirada ou inativa
                    window.location.href = 'ativacao.html';
                }

            } catch (error) {
                console.error("Erro crítico na inicialização:", error);
                showAppNotification("Erro ao carregar seu perfil. Tente atualizar a página.");
            }

        } else {
            // Se não estiver logado e tentar acessar página protegida
            if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
                window.location.href = 'index.html';
            }
        }
    });
}

function setupCommonUI(user) {
    const menuBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-btn');
    const aside = document.querySelector('aside');
    if(menuBtn) menuBtn.addEventListener('click', () => aside.classList.add('show-sidebar'));
    if(closeBtn) closeBtn.addEventListener('click', () => aside.classList.remove('show-sidebar'));

    const themeTogglerLink = document.getElementById('theme-toggler-link');
    
    if (document.documentElement.classList.contains('dark-theme')) {
        const icon = themeTogglerLink ? themeTogglerLink.querySelector('span') : null;
        if(icon) icon.textContent = 'dark_mode';
    }

    if (themeTogglerLink) {
        themeTogglerLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.documentElement.classList.toggle('dark-theme');
            const isDark = document.documentElement.classList.contains('dark-theme');
            const icon = themeTogglerLink.querySelector('span');
            if(icon) icon.textContent = isDark ? 'dark_mode' : 'light_mode';
            localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            firestoreUnsubscribes.forEach(unsubscribe => unsubscribe());
            firestoreUnsubscribes = [];
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
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
        const closeModBtn = document.getElementById('app-notification-close-btn');
        if(closeModBtn) closeModBtn.addEventListener('click', () => notificationModal.style.display = 'none');
        notificationModal.addEventListener('click', (e) => {
            if (e.target === notificationModal) notificationModal.style.display = 'none';
        });
    }
}
