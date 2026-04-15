// Configuração do Firebase - Studio Stephanie Sena
// Não comita credenciais sensíveis em repositórios públicos

// Carregar Firebase globalmente
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

  // Inicializar Firebase
  if (typeof firebase === 'undefined') {
    // Carregar scripts do Firebase
    const scripts = [
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js',
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js',
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
    ];
    
    let loaded = 0;
    scripts.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        loaded++;
        if (loaded === scripts.length) {
          initializeFirebase();
        }
      };
      document.head.appendChild(script);
    });
  } else {
    initializeFirebase();
  }
  
  function initializeFirebase() {
    try {
      // Inicializar Firebase
      window.firebaseApp = firebase.initializeApp(firebaseConfig);
      window.firebaseAnalytics = firebase.getAnalytics(window.firebaseApp);
      window.firebaseFirestore = firebase.getFirestore(window.firebaseApp);
      
      // Disparar evento de carregamento
      window.dispatchEvent(new CustomEvent('firebaseLoaded'));
      
      console.log('Firebase inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar Firebase:', error);
    }
  }
})();
