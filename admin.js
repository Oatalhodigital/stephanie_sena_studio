import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Configuração Firebase (mesma do firebase-config.js)
const firebaseConfig = {
  apiKey: "AIzaSyA_6I9MmZ_B6hb0QwqewYyciDIpdAAK9D0",
  authDomain: "studio-stephanie-sena.firebaseapp.com",
  projectId: "studio-stephanie-sena",
  storageBucket: "studio-stephanie-sena.firebasestorage.app",
  messagingSenderId: "697438120393",
  appId: "1:697438120393:web:b586bef9902f767684e018"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado
let allBookings = [];
let currentFilter = 'todos';

// Elementos DOM
const loginSection = document.getElementById('loginSection');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const adminPassword = document.getElementById('adminPassword');
const bookingsList = document.getElementById('bookingsList');

// Senha de acesso (simples para demonstração)
const ADMIN_PASSWORD = 'stephanie2026';

// Funções de data
function formatDateBR(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function isToday(dateISO) {
  const today = new Date().toISOString().split('T')[0];
  return dateISO === today;
}

function isThisWeek(dateISO) {
  const today = new Date();
  const bookingDate = new Date(dateISO);
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return bookingDate >= today && bookingDate <= weekFromNow;
}

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (adminPassword.value === ADMIN_PASSWORD) {
    loginSection.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    await loadBookings();
    
    // Log de acesso bem-sucedido
    console.log('Login administrativo realizado com sucesso');
  } else {
    alert('Senha incorreta!');
    adminPassword.value = '';
  }
});

// Carregar agendamentos
async function loadBookings() {
  try {
    const q = query(
      collection(db, "agendamentos"),
      orderBy("dateISO", "asc")
    );
    
    const snapshot = await getDocs(q);
    allBookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    filterBookings();
  } catch (error) {
    console.error('Erro ao carregar agendamentos:', error);
    bookingsList.innerHTML = '<p style="color: red;">Erro ao carregar agendamentos</p>';
  }
}

// Filtrar agendamentos
function filterBookings() {
  let filtered = [...allBookings];
  
  switch (currentFilter) {
    case 'hoje':
      filtered = filtered.filter(booking => isToday(booking.dateISO));
      break;
    case 'semana':
      filtered = filtered.filter(booking => isThisWeek(booking.dateISO));
      break;
    case 'pendente':
    case 'confirmado':
    case 'cancelado':
      filtered = filtered.filter(booking => booking.status === currentFilter);
      break;
  }
  
  renderBookings(filtered);
}

// Renderizar agendamentos
function renderBookings(bookings) {
  if (bookings.length === 0) {
    bookingsList.innerHTML = '<p style="text-align: center; color: #6b7280;">Nenhum agendamento encontrado</p>';
    return;
  }
  
  bookingsList.innerHTML = bookings.map(booking => `
    <div class="booking-card ${booking.status}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: var(--preto);">${booking.nome}</h3>
        <span class="status-badge status-${booking.status}">${booking.status}</span>
      </div>
      
      <div class="booking-info">
        <div class="info-item">
          <span class="info-label">📅 Data:</span>
          <span class="info-value">${formatDateBR(booking.dateISO)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">⏰ Horário:</span>
          <span class="info-value">${booking.hour}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📱 Celular:</span>
          <span class="info-value">${booking.celular}</span>
        </div>
        <div class="info-item">
          <span class="info-label">💅 Serviço:</span>
          <span class="info-value">${booking.servico || 'Não informado'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📝 Criado em:</span>
          <span class="info-value">${booking.createdAt ? new Date(booking.createdAt.toDate()).toLocaleString('pt-BR') : 'N/A'}</span>
        </div>
      </div>
      
      ${booking.status === 'pendente' ? `
        <div style="margin-top: 15px; display: flex; gap: 10px;">
          <button onclick="updateBookingStatus('${booking.id}', 'confirmado')" style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Confirmar
          </button>
          <button onclick="confirmCancel('${booking.id}')" style="flex: 1; padding: 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Cancelar
          </button>
        </div>
      ` : booking.status === 'confirmado' ? `
        <div style="margin-top: 15px; display: flex; gap: 10px;">
          <div style="flex: 1; padding: 8px; background: #28a745; color: white; border: none; border-radius: 4px; text-align: center;">
            Confirmado
          </div>
          <button onclick="confirmCancel('${booking.id}')" style="flex: 1; padding: 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Cancelar
          </button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Sistema de notificações
function showNotification(title, message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 300px;
    animation: slideIn 0.3s ease;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
    <div style="font-size: 14px;">${message}</div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto remover após 5 segundos
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

// Confirmar cancelamento com diálogo
window.confirmCancel = async function(bookingId) {
  const confirmed = confirm('Deseja realmente cancelar este agendamento? O horário ficará disponível novamente no site.');
  
  if (confirmed) {
    await updateBookingStatus(bookingId, 'cancelado');
  }
};

// Atualizar status do agendamento
window.updateBookingStatus = async function(bookingId, newStatus) {
  console.log('Iniciando atualização:', { bookingId, newStatus });
  
  try {
    // Validação do documento
    if (!bookingId || bookingId.trim() === '') {
      console.error('ID do agendamento inválido:', bookingId);
      alert('ID do agendamento inválido');
      return;
    }
    
    const ref = doc(db, "agendamentos", bookingId);
    console.log('Referência criada:', ref.path);
    
    // Simplificar: apenas atualizar sem verificar existência
    await updateDoc(ref, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    
    console.log('Documento atualizado com sucesso');
    
    // Notificação especial para cancelamento
    if (newStatus === 'cancelado') {
      showNotification('Horário liberado!', 'O horário foi cancelado e está disponível novamente no site.', 'success');
    }
    
    // Recarregar a lista
    await loadBookings();
    
    console.log(`Agendamento ${bookingId} atualizado para ${newStatus}`);
    
  } catch (error) {
    console.error('Erro completo:', error);
    console.error('Código do erro:', error.code);
    console.error('Mensagem do erro:', error.message);
    
    alert(`Erro ao atualizar status: ${error.message}`);
  }
};

// Event listeners dos filtros
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    filterBookings();
  });
});

// Auto-recarregar a cada 30 segundos
setInterval(() => {
  if (!loginSection.classList.contains('hidden')) {
    loadBookings();
  }
}, 30000);
