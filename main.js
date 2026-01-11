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
 * LÓGICA DE INICIALIZAÇÃO OTIMIZADA
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
                let doc = await userRef.get();

                // 1. SE O USUÁRIO É NOVO (NÃO TEM DOC NO FIRESTORE)
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
                    
                    // Dispara e-mail de verificação silenciosamente (opcional)
                    if (!user.emailVerified) {
                        user.sendEmailVerification().catch(e => console.log("Email já enviado ou erro."));
                    }

                    showAppNotification(`Bem-vindo ao Stolinx! Você ganhou 30 dias de teste grátis para explorar todas as funções.`, "Boas-vindas!");
                    
                    // Recarrega o doc para prosseguir
                    doc = await userRef.get();
                }

                const userData = doc.data();
                const now = new Date();

                // 2. VERIFICAÇÃO DE ASSINATURA (TRIAL OU PAGO)
                if (userData.active && userData.expiresAt && userData.expiresAt.toDate() > now) {
                    
                    // Se o e-mail ainda não foi verificado, mostramos apenas um lembrete sutil, sem bloquear
                    if (!user.emailVerified) {
                        console.log("Aviso: E-mail ainda não verificado, mas acesso liberado pelo Trial.");
                    }

                    // INICIALIZA A INTERFACE (Remove o "Carregando")
                    setupCommonUI(user);
                    if (config.init) config.init();
                    
                } else {
                    // Assinatura expirada
                    window.location.href = 'ativacao.html';
                }

            } catch (error) {
                console.error("Erro na inicialização:", error);
                showAppNotification("Erro ao carregar perfil.");
            }
        } else {
            if (window.location.pathname.includes('dashboard.html')) {
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
