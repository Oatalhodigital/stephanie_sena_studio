// Configuração do Firebase - Studio Stephanie Sena
// Não comita credenciais sensíveis em repositórios públicos

// Carregar Firebase SDKs globalmente
(function() {
  const firebaseConfig = {
    apiKey: "AIzaSyA_6I9MmZ_B6hb0QwqewYyciDIpdAAK9D0",
    authDomain: "studio-stephanie-sena.firebaseapp.com",
    projectId: "studio-stephanie-sena",
    storageBucket: "studio-stephanie-sena.firebasestorage.app",
    messagingSenderId: "697438120393",
    appId: "1:697438120393:web:b586bef9902f767684e018",
    measurementId: "G-T2XMTXZ81M"
  };

  // Carregar scripts do Firebase na ordem correta
  const scripts = [
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js',
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js'
  ];
  
  let loaded = 0;
  
  function initializeFirebase() {
    try {
      // Inicializar Firebase
      firebase.initializeApp(firebaseConfig);
      
      // Disponibilizar globalmente
      window.db = firebase.firestore();
      window.analytics = firebase.analytics();
      
      // Disparar evento de carregamento
      window.dispatchEvent(new CustomEvent('firebaseLoaded'));
      
      console.log('✅ Firebase inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar Firebase:', error);
      // Inicializar modo local se Firebase falhar
      window.dispatchEvent(new CustomEvent('firebaseLoaded'));
    }
  }
  
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  // Carregar todos os scripts
  Promise.all(scripts.map(loadScript))
    .then(() => {
      console.log('📦 Todos os scripts Firebase carregados');
      initializeFirebase();
    })
    .catch(error => {
      console.error('❌ Erro ao carregar scripts Firebase:', error);
      // Inicializar modo local
      window.dispatchEvent(new CustomEvent('firebaseLoaded'));
    });
})();
