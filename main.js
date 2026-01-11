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
 * LÓGICA DE INICIALIZAÇÃO COM TRIAL E VERIFICAÇÃO DE E-MAIL
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

            // 1. Verificar se o e-mail foi verificado
            if (!user.emailVerified) {
                // Se não estiver na index, redireciona para uma página de aviso ou desloga
                // Aqui vamos apenas mostrar a notificação e impedir o init
                showAppNotification("Por favor, verifique seu e-mail para ativar sua conta. Verifique sua caixa de entrada ou spam.", "E-mail não verificado");
                // Opcional: auth.signOut();
                return;
            }

            userRef.get().then(async (doc) => {
                const now = new Date();
                
                if (doc.exists) {
                    const userData = doc.data();
                    
                    // Verifica se assinatura está ativa e dentro do prazo
                    if (userData.active && userData.expiresAt && userData.expiresAt.toDate() > now) {
                        setupCommonUI(user);
                        if (config.init) config.init();
                    } else {
                        // Assinatura expirada
                        window.location.href = 'ativacao.html';
                    }
                } else {
                    /**
                     * NOVO USUÁRIO: Criar perfil com 30 dias de trial e enviar verificação
                     */
                    const trialEndDate = new Date();
                    trialEndDate.setDate(now.getDate() + 30);

                    const newUserProfile = {
                        email: user.email,
                        active: true,
                        trialUsed: true,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        expiresAt: firebase.firestore.Timestamp.fromDate(trialEndDate)
                    };

                    try {
                        await userRef.set(newUserProfile);
                        // Enviar e-mail de verificação
                        await user.sendEmailVerification();
                        
                        showAppNotification("Sua conta de teste de 30 dias foi criada! Enviamos um e-mail de verificação. Por favor, valide-o para acessar o sistema.", "Sucesso!");
                        
                        console.log("Perfil criado e e-mail de verificação enviado.");
                    } catch (error) {
                        console.error("Erro ao configurar novo usuário:", error);
                        showAppNotification("Erro ao configurar seu período de teste ou enviar e-mail.");
                    }
                }
            });
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
