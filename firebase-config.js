// Configuração do Firebase - Studio Stephanie Sena
// Não comita credenciais sensíveis em repositórios públicos

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_6I9MmZ_B6hb0QwqewYyciDIpdAAK9D0",
  authDomain: "studio-stephanie-sena.firebaseapp.com",
  projectId: "studio-stephanie-sena",
  storageBucket: "studio-stephanie-sena.firebasestorage.app",
  messagingSenderId: "697438120393",
  appId: "1:697438120393:web:b586bef9902f767684e018",
  measurementId: "G-T2XMTXZ81M"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
