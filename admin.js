import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  or,
  getDocs,
  getDoc,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot
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
const blockDate = document.getElementById('blockDate');
const blockHour = document.getElementById('blockHour');
const btnBlockTime = document.getElementById('btnBlockTime');
const btnUnblockTime = document.getElementById('btnUnblockTime');
const menuToggle = document.getElementById('menuToggle');
const sideMenu = document.getElementById('sideMenu');
const closeMenu = document.getElementById('closeMenu');
const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const historyList = document.getElementById('historyList');
const btnCleanHistory = document.getElementById('btnCleanHistory');
const btnViewHistory = document.getElementById('btnViewHistory');
const btnExportData = document.getElementById('btnExportData');
const btnSyncRecovery = document.getElementById('btnSyncRecovery');

// Senha de acesso (simples para demonstração)
const ADMIN_PASSWORD = 'stephanie2026';

// 🗑️ FUNÇÃO OBSOLETA REMOVIDA: verificarSeEhEssaSemana
// Substituída por isThisWeek() que é mais eficiente

// � FUNÇÕES GLOBAIS DO MENU FERRAMENTAS (Definidas no topo para garantir escopo global)

// Função de Sync/Recovery para recuperar agendamentos >= 2026-05-01
window.syncRecoveryAgendamentos = async function() {
  try {
    console.log('🔄 Iniciando Sync/Recovery de agendamentos...');
    
    // Buscar todos os agendamentos sem filtro
    const q = query(collection(db, "agendamentos"));
    const snapshot = await getDocs(q);
    
    let recuperados = 0;
    let corrigidos = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const booking = docSnapshot.data();
      
      // Verificar se é um agendamento a partir de 01/05/2026
      if (booking.dateISO >= "2026-05-01") {
        
        // Se estiver arquivado indevidamente, recuperar
        if (booking.arquivado === true && booking.dateISO >= new Date().toISOString().split('T')[0]) {
          await updateDoc(docSnapshot.ref, {
            arquivado: false,
            dataArquivamento: null,
            updatedAt: serverTimestamp()
          });
          recuperados++;
          console.log(`✅ Agendamento recuperado: ${booking.nome} - ${booking.dateISO} ${booking.hour}`);
        }
        
        // Garantir que não está arquivado se for futuro
        const dataAgendamento = new Date(booking.dateISO);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        if (dataAgendamento >= hoje && booking.arquivado === true) {
          await updateDoc(docSnapshot.ref, {
            arquivado: false,
            dataArquivamento: null,
            updatedAt: serverTimestamp()
          });
          corrigidos++;
          console.log(`🔧 Agendamento corrigido: ${booking.nome} - ${booking.dateISO} ${booking.hour}`);
        }
      }
    }
    
    console.log(`📊 Sync/Recovery concluído:`);
    console.log(`- Agendamentos recuperados: ${recuperados}`);
    console.log(`- Agendamentos corrigidos: ${corrigidos}`);
    
    // Recarregar dados
    await loadBookings();
    
    alert(`Sync/Recovery concluído!\n${recuperados} agendamentos recuperados\n${corrigidos} agendamentos corrigidos`);
    
  } catch (error) {
    console.error('❌ Erro no Sync/Recovery:', error);
    alert('Erro ao executar Sync/Recovery. Verifique o console.');
  }
};

// 🌐 GARANTINDO ESCOPO GLOBAL EXPLÍCITO PARA HTML
window.syncRecoveryAgendamentos = window.syncRecoveryAgendamentos; // Garante que HTML enxergue a função

// Função para limpeza automática inteligente (arquivamento)
window.cleanOldBookings = async function() {
  try {
    if (!confirm('Deseja arquivar todos os agendamentos antigos? Eles ficarão ocultos na lista principal mas ficarão acessíveis no histórico.')) {
      return;
    }

    const agora = new Date();
    const q = query(collection(db, "agendamentos"));
    const querySnapshot = await getDocs(q);
    
    let archivedCount = 0;
    
    for (const docSnapshot of querySnapshot.docs) {
      const booking = docSnapshot.data();
      const bookingDateTime = new Date(`${booking.dateISO}T${booking.hour}:00`);
      
      // Critérios para arquivamento automático:
      // 1. Agendamentos passados (mais de 24h atrás)
      // 2. Não arquivados ainda
      // 3. Status confirmado ou cancelado (não pendentes)
      const isOld = bookingDateTime < new Date(agora.getTime() - 24 * 60 * 60 * 1000);
      const isNotArchived = !booking.arquivado;
      const isCompleted = booking.status === 'confirmado' || booking.status === 'cancelado';
      
      if (isOld && isNotArchived && isCompleted) {
        // Arquivar em vez de mover
        await updateDoc(docSnapshot.ref, {
          arquivado: true,
          dataArquivamento: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        archivedCount++;
      }
    }
    
    // Recarregar lista
    await loadBookings();
    
    alert(`${archivedCount} agendamentos arquivados com sucesso!`);
    console.log(`Limpeza automática concluída: ${archivedCount} agendamentos arquivados`);
    
  } catch (error) {
    console.error('Erro ao limpar agendamentos antigos:', error);
    alert('Erro ao limpar agendamentos antigos. Tente novamente.');
  }
};

// Função para carregar histórico completo (arquivados === true OU status === 'cancelado')
window.loadHistory = async function() {
  try {
    console.log('📊 Carregando histórico completo...');
    
    // Buscar todos os agendamentos onde arquivado === true OU status === 'cancelado'
    const historicoQuery = query(
      collection(db, "agendamentos"),
      or(
        where("arquivado", "==", true),
        where("status", "==", "cancelado")
      ),
      orderBy("updatedAt", "desc")
    );
    
    const historicoSnapshot = await getDocs(historicoQuery);
    const allHistoryItems = [];
    
    historicoSnapshot.forEach((doc) => {
      const booking = doc.data();
      const isArquivado = booking.arquivado === true;
      const isCancelado = booking.status === 'cancelado';
      
      // Determinar o tipo e data de movimento
      let tipo = '';
      let dataMovimento = new Date();
      let origem = '';
      
      if (isArquivado) {
        tipo = 'arquivado';
        dataMovimento = booking.dataArquivamento?.toDate() || booking.updatedAt?.toDate() || new Date();
        origem = 'Arquivado automaticamente';
      } else if (isCancelado) {
        tipo = 'cancelado';
        dataMovimento = booking.updatedAt?.toDate() || booking.createdAt?.toDate() || new Date();
        origem = 'Cancelado';
      }
      
      allHistoryItems.push({
        ...booking,
        id: doc.id,
        tipo: tipo,
        dataMovimento: dataMovimento,
        origem: origem
      });
    });
    
    // Ordenar por data de movimento (mais recente primeiro)
    allHistoryItems.sort((a, b) => b.dataMovimento - a.dataMovimento);
    
    if (allHistoryItems.length === 0) {
      historyList.innerHTML = '<p style="text-align: center; color: #6b7280;">Nenhum agendamento no histórico.</p>';
      historyModal.classList.add('open');
      console.log('📊 Histórico vazio');
      return;
    }
    
    let historyHTML = '<div class="history-grid">';
    
    allHistoryItems.forEach((item) => {
      const statusLabel = getStatusLabel(item.status);
      const dataMovimentoFormatada = item.dataMovimento.toLocaleDateString('pt-BR');
      
      historyHTML += `
        <div class="history-item ${item.tipo === 'arquivado' ? 'arquivado-item' : 'cancelado-item'}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h4 style="margin: 0; color: var(--preto);">${item.nome}</h4>
            <div style="text-align: right;">
              <span style="font-size: 0.7rem; color: #6b7280;">
                ${item.origem}
              </span><br>
              <span style="font-size: 0.8rem; color: #6b7280; font-weight: bold;">
                ${dataMovimentoFormatada}
              </span>
            </div>
          </div>
          <div class="booking-info">
            <div class="info-item">
              <span class="info-label">📅 Data:</span>
              <span class="info-value">${formatDateBR(item.dateISO)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">⏰ Horário:</span>
              <span class="info-value">${item.hour}</span>
            </div>
            <div class="info-item">
              <span class="info-label">💅 Serviço:</span>
              <span class="info-value">${item.servico}</span>
            </div>
            <div class="info-item">
              <span class="info-label">📱 Celular:</span>
              <span class="info-value">${item.celular}</span>
            </div>
            <div class="info-item">
              <span class="info-label">📊 Status:</span>
              <span class="info-value">${statusLabel}</span>
            </div>
            <div class="info-item">
              <span class="info-label">🗃️ Tipo:</span>
              <span class="info-value" style="color: ${item.tipo === 'arquivado' ? '#6c757d' : '#dc3545'};">
                ${item.tipo === 'arquivado' ? 'Arquivado' : 'Cancelado'}
              </span>
            </div>
          </div>
        </div>
      `;
    });
    
    historyHTML += '</div>';
    historyList.innerHTML = historyHTML;
    historyModal.classList.add('open');
    
    console.log(`✅ Histórico carregado: ${allHistoryItems.length} itens`);
    
  } catch (error) {
    console.error('❌ Erro ao carregar histórico:', error);
    historyList.innerHTML = '<p style="text-align: center; color: #dc3545;">Erro ao carregar histórico.</p>';
  }
};

// Função para exportar dados
window.exportData = async function() {
  try {
    console.log('📥 Iniciando exportação de dados...');
    
    const q = query(collection(db, "agendamentos"));
    const querySnapshot = await getDocs(q);
    
    const data = [];
    querySnapshot.forEach((doc) => {
      data.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Criar CSV
    const headers = ['ID', 'Nome', 'Celular', 'Serviço', 'Data', 'Horário', 'Status', 'Status Financeiro', 'Criado em'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        row.id,
        `"${row.nome}"`,
        row.celular,
        `"${row.servico}"`,
        row.dateISO,
        row.hour,
        row.status,
        row.statusFinanceiro || '',
        row.createdAt?.toDate()?.toLocaleString('pt-BR') || ''
      ].join(','))
    ].join('\n');
    
    // Download do arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agendamentos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    alert('Dados exportados com sucesso!');
    console.log('✅ Exportação concluída com sucesso');
    
  } catch (error) {
    console.error('❌ Erro ao exportar dados:', error);
    alert('Erro ao exportar dados. Tente novamente.');
  }
};

// Funções de Bloqueio de Horários
window.blockTimeSlot = async function() {
  try {
    const date = blockDate.value;
    const hour = blockHour.value;
    
    if (!date || !hour) {
      alert('Por favor, selecione uma data e um horário para bloquear.');
      return;
    }

    if (!confirm(`Deseja bloquear o horário ${hour} do dia ${formatDateBR(date)}?`)) {
      return;
    }

    // Salvar bloqueio como agendamento real na coleção agendamentos
    const docRef = await addDoc(collection(db, "agendamentos"), {
      nome: "HORÁRIO BLOQUEADO",
      celular: "00000000000",
      servico: "Bloqueio Administrativo",
      dateISO: date,
      hour: hour,
      status: "bloqueado",
      statusFinanceiro: "bloqueado",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      blockedBy: 'admin'
    });

    // Limpar campos
    blockDate.value = '';
    blockHour.value = '';

    // Recarregar lista
    await loadBookings();
    
    alert('Horário bloqueado com sucesso!');
    console.log(`Horário bloqueado como agendamento: ${date} ${hour}`);
    
  } catch (error) {
    console.error('Erro ao bloquear horário:', error);
    alert('Erro ao bloquear horário. Tente novamente.');
  }
};

window.unblockTimeSlot = async function() {
  try {
    const date = blockDate.value;
    const hour = blockHour.value;
    
    if (!date || !hour) {
      alert('Por favor, selecione uma data e um horário para desbloquear.');
      return;
    }

    if (!confirm(`Deseja desbloquear o horário ${hour} do dia ${formatDateBR(date)}?`)) {
      return;
    }

    // Buscar e remover agendamento bloqueado na coleção agendamentos
    const q = query(
      collection(db, "agendamentos"),
      where("dateISO", "==", date),
      where("hour", "==", hour),
      where("nome", "==", "HORÁRIO BLOQUEADO")
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      alert('Nenhum bloqueio encontrado para este horário.');
      return;
    }

    // Remover todos os agendamentos bloqueados encontrados
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Limpar campos
    blockDate.value = '';
    blockHour.value = '';

    // Recarregar lista
    await loadBookings();
    
    alert('Horário desbloqueado com sucesso!');
    console.log(`Horário desbloqueado: ${date} ${hour}`);
    
  } catch (error) {
    console.error('Erro ao desbloquear horário:', error);
    alert('Erro ao desbloquear horário. Tente novamente.');
  }
};
window.unblockTimeSlot = window.unblockTimeSlot;

// � FUNÇÕES DE DATA (Modernizadas ES6+)
const formatDateBR = (isoDate) => {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};
window.formatDateBR = window.formatDateBR;

const isToday = (dateISO) => {
  const today = new Date().toISOString().split('T')[0];
  return dateISO === today;
};
window.isToday = window.isToday;

const isThisWeek = (dateISO) => {
  const today = new Date();
  const bookingDate = new Date(dateISO);
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return bookingDate >= startOfWeek && bookingDate <= endOfWeek;
};
window.isThisWeek = window.isThisWeek;

// 💰 STATUS FINANCEIRO (Modernizado ES6+)
const formatStatusFinanceiro = (status) => {
  const statusMap = {
    'aguardando_pagamento': 'Aguardando Pagamento',
    'pendente_confirmacao': 'Pagamento Informado',
    'pago': 'Sinal Confirmado',
    'pagamento_recusado': 'Pagamento Recusado'
  };
  return statusMap[status] || status;
};
window.formatStatusFinanceiro = window.formatStatusFinanceiro;

// Filtrar agendamentos com lógica rigorosa
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

// Função de Sync/Recovery para recuperar agendamentos >= 2026-05-01
window.syncRecoveryAgendamentos = async function() {
  try {
    console.log('🔄 Iniciando Sync/Recovery de agendamentos...');
    
    // Buscar todos os agendamentos sem filtro
    const q = query(collection(db, "agendamentos"));
    const snapshot = await getDocs(q);
    
    let recuperados = 0;
    let corrigidos = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const booking = docSnapshot.data();
      
      // Verificar se é um agendamento a partir de 01/05/2026
      if (booking.dateISO >= "2026-05-01") {
        
        // Se estiver arquivado indevidamente, recuperar
        if (booking.arquivado === true && booking.dateISO >= new Date().toISOString().split('T')[0]) {
          await updateDoc(docSnapshot.ref, {
            arquivado: false,
            dataArquivamento: null,
            updatedAt: serverTimestamp()
          });
          recuperados++;
          console.log(`✅ Agendamento recuperado: ${booking.nome} - ${booking.dateISO} ${booking.hour}`);
        }
        
        // Garantir que não está arquivado se for futuro
        const dataAgendamento = new Date(booking.dateISO);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        if (dataAgendamento >= hoje && booking.arquivado === true) {
          await updateDoc(docSnapshot.ref, {
            arquivado: false,
            dataArquivamento: null,
            updatedAt: serverTimestamp()
          });
          corrigidos++;
          console.log(`🔧 Agendamento corrigido: ${booking.nome} - ${booking.dateISO} ${booking.hour}`);
        }
      }
    }
    
    console.log(`📊 Sync/Recovery concluído:`);
    console.log(`- Agendamentos recuperados: ${recuperados}`);
    console.log(`- Agendamentos corrigidos: ${corrigidos}`);
    
    // Recarregar dados
    await loadBookings();
    
    alert(`Sync/Recovery concluído!\n${recuperados} agendamentos recuperados\n${corrigidos} agendamentos corrigidos`);
    
  } catch (error) {
    console.error('❌ Erro no Sync/Recovery:', error);
    alert('Erro ao executar Sync/Recovery. Verifique o console.');
  }
};
window.syncRecoveryAgendamentos = window.syncRecoveryAgendamentos;

// Arquivar automaticamente agendamentos de datas e horas passadas (CORRIGIDO)
async function arquivarAgendamentosAntigos() {
  try {
    const agora = new Date(); // Data e hora atual
    
    const q = query(collection(db, "agendamentos"));
    const snapshot = await getDocs(q);
    
    let arquivados = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const booking = docSnapshot.data();
      
      // Verificar se já está arquivado
      if (booking.arquivado) continue;
      
      // CORREÇÃO: Verificar se a data é realmente anterior à data atual
      const dataAgendamento = new Date(booking.dateISO + 'T00:00:00');
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      // Arquivar apenas se a data for anterior E horário já passou
      const isDataAnterior = dataAgendamento < hoje;
      const isHorarioPassado = isDataAnterior || (dataAgendamento.getTime() === hoje.getTime() && 
        new Date(`${booking.dateISO}T${booking.hour}:00`) < agora);
      
      if (isHorarioPassado && 
          (booking.status === 'confirmado' || booking.status === 'pendente')) {
        
        // Arquivar agendamento
        await updateDoc(docSnapshot.ref, {
          arquivado: true,
          dataArquivamento: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        arquivados++;
        
        console.log(`📦 Agendamento arquivado: ${booking.nome} - ${booking.dateISO} ${booking.hour}`);
      }
    }
    
    if (arquivados > 0) {
      console.log(`${arquivados} agendamentos arquivados automaticamente`);
    }
    
  } catch (error) {
    console.error('Erro ao arquivar agendamentos antigos:', error);
  }
}
window.arquivarAgendamentosAntigos = window.arquivarAgendamentosAntigos;

// Listener em tempo real para atualizações instantâneas
let realtimeListener = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectTimeout = null;

// Carregar agendamentos com listener em tempo real
async function loadBookings() {
  try {
    // Remover listener anterior se existir
    if (realtimeListener) {
      realtimeListener();
      realtimeListener = null;
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    // Primeiro, arquivar agendamentos antigos (apenas uma vez)
    await arquivarAgendamentosAntigos();
    
    // Configurar query com listener em tempo real
    const q = query(
      collection(db, "agendamentos"),
      orderBy("dateISO", "asc")
    );
    
    // Listener em tempo real com tratamento de erro robusto
    realtimeListener = onSnapshot(q, (snapshot) => {
      console.log('🔄 Atualização em tempo real recebida:', snapshot.docs.length, 'documentos');
      
      // Resetar contador de reconexão em caso de sucesso
      reconnectAttempts = 0;
      
      allBookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      filterBookings();
      
      // Mostrar notificação de novos agendamentos
      const novosAgendamentos = snapshot.docChanges().filter(change => 
        change.type === 'added' && !change.doc.metadata.hasPendingWrites
      );
      
      if (novosAgendamentos.length > 0) {
        console.log(`📋 ${novosAgendamentos.length} novo(s) agendamento(s) recebido(s)`);
        showNotification(`${novosAgendamentos.length} novo(s) agendamento(s) recebido(s)`);
      }
      
      // Detectar cancelamentos e mostrar notificação
      const cancelamentos = snapshot.docChanges().filter(change => 
        change.type === 'modified' && change.doc.data().status === 'cancelado'
      );
      
      if (cancelamentos.length > 0) {
        console.log(`❌ ${cancelamentos.length} agendamento(s) cancelado(s)`);
        showNotification(`${cancelamentos.length} agendamento(s) cancelado(s) - horário liberado no site`);
      }
      
    }, (error) => {
      console.error('❌ Erro no listener em tempo real:', error);
      bookingsList.innerHTML = '<p style="color: red;">Erro na conexão em tempo real</p>';
      
      // TENTATIVA DE RECONEXÃO AUTOMÁTICA
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff até 30s
        console.log(`🔄 Tentando reconexão automática (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) em ${delay}ms...`);
        
        reconnectTimeout = setTimeout(() => {
          console.log('🔄 Executando reconexão...');
          loadBookings();
        }, delay);
      } else {
        console.error('❌ Máximo de tentativas de reconexão atingido. Por favor, recarregue a página.');
        bookingsList.innerHTML = '<p style="color: red;">Erro persistente na conexão. Por favor, recarregue a página.</p>';
      }
    });
    
  } catch (error) {
    console.error('Erro ao carregar agendamentos:', error);
    bookingsList.innerHTML = '<p style="color: red;">Erro ao carregar agendamentos</p>';
  }
}
window.loadBookings = window.loadBookings;

window.addEventListener('beforeunload', () => {
  if (realtimeListener) {
    realtimeListener();
    realtimeListener = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
});

// Função para mostrar notificações visuais
function showNotification(message) {
  // Criar elemento de notificação
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-weight: bold;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  
  // Adicionar ao DOM
  document.body.appendChild(notification);
  
  // Remover após 3 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}
window.showNotification = window.showNotification;

// Verificar se horário já passou
function isHorarioPassado(dateISO, hour) {
  const agora = new Date();
  const dataHoraAgendamento = new Date(`${dateISO}T${hour}:00`);
  return dataHoraAgendamento < agora;
}
window.isHorarioPassado = window.isHorarioPassado;

// Filtrar agendamentos com lógica rigorosa e remoção automática por horário
function filterBookings() {
  let filtered = [...allBookings];
  
  // Aplicar filtro principal: apenas arquivado === false e status !== 'cancelado'
  filtered = filtered.filter(booking => {
    const isNotArquivado = booking.arquivado !== true;
    const isNotCancelado = booking.status !== 'cancelado';
    return isNotArquivado && isNotCancelado;
  });
  
  switch (currentFilter) {
    case 'hoje':
      // Hoje: apenas agendamentos de hoje E que ainda não passaram o horário E não bloqueados
      filtered = filtered.filter(booking => {
        const isHoje = isToday(booking.dateISO);
        const isHorarioNaoPassado = !isHorarioPassado(booking.dateISO, booking.hour);
        const isNotBloqueado = booking.status !== 'bloqueado';
        return isHoje && isHorarioNaoPassado && isNotBloqueado;
      });
      break;
    case 'semana':
      // Esta Semana: apenas agendamentos da semana E que ainda não passaram o horário E não bloqueados
      filtered = filtered.filter(booking => {
        const isEstaSemana = isThisWeek(booking.dateISO);
        const isHorarioNaoPassado = !isHorarioPassado(booking.dateISO, booking.hour);
        const isNotBloqueado = booking.status !== 'bloqueado';
        return isEstaSemana && isHorarioNaoPassado && isNotBloqueado;
      });
      break;
    case 'mes_atual':
      // Mês Atual: apenas agendamentos do mês corrente (lógica dinâmica)
      filtered = filtered.filter(booking => {
        const dataAgendamento = new Date(booking.dateISO);
        const agora = new Date();
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
        const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
        fimMes.setHours(23, 59, 59, 999);
        
        const isMesAtual = dataAgendamento >= inicioMes && dataAgendamento <= fimMes;
        const isNotBloqueado = booking.status !== 'bloqueado';
        const isHorarioNaoPassado = !isHorarioPassado(booking.dateISO, booking.hour);
        
        console.log(`📅 Verificando mês atual para ${booking.dateISO}: ${isMesAtual}`);
        return isMesAtual && isNotBloqueado && isHorarioNaoPassado;
      });
      break;
    case 'aguardando_pagamento':
      // Aguardando Pagamento: exibir independentemente do horário (prioridade) mas não cancelados/bloqueados
      filtered = filtered.filter(booking => {
        const isAguardandoPagamento = booking.statusFinanceiro === currentFilter;
        const isNotBloqueado = booking.status !== 'bloqueado';
        return isAguardandoPagamento && isNotBloqueado;
      });
      break;
    default:
      // Filtro não reconhecido - manter apenas o filtro principal já aplicado
      break;
  }
  
  renderBookings(filtered);
}
window.filterBookings = window.filterBookings;

// Renderizar agendamentos
function renderBookings(bookings) {
  if (bookings.length === 0) {
    bookingsList.innerHTML = '<p style="text-align: center; color: #6b7280;">Nenhum agendamento encontrado</p>';
    return;
  }
  
  bookingsList.innerHTML = bookings.map(booking => {
    const statusFinanceiroLabel = booking.statusFinanceiro ? getFinanceiroStatusLabel(booking.statusFinanceiro) : '';
    const statusLabel = getStatusLabel(booking.status);
    
    return `
    <div class="booking-card ${booking.status}">
      ${booking.status === 'confirmado' ? `
        <div style="position: absolute; top: 10px; right: 10px; background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; z-index: 1;">
          ✅ CONFIRMADO
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: var(--preto);">${booking.nome}</h3>
        <div class="status-badges">
          ${booking.statusFinanceiro ? `<span class="status-badge status-${booking.statusFinanceiro}">${statusFinanceiroLabel}</span>` : ''}
          <span class="status-badge status-${booking.status}">${statusLabel}</span>
        </div>
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
      
      ${booking.valorTotal ? `
        <div class="financeiro-info">
          <h4>💰 Informações Financeiras</h4>
          <div class="financeiro-values">
            <div class="financeiro-item">
              <div class="financeiro-label">Valor Total</div>
              <div class="financeiro-value">R$ ${booking.valorTotal.toFixed(2).replace('.', ',')}</div>
            </div>
            <div class="financeiro-item">
              <div class="financeiro-label">Sinal (30%)</div>
              <div class="financeiro-value sinal">R$ ${booking.valorSinal.toFixed(2).replace('.', ',')}</div>
            </div>
            <div class="financeiro-item">
              <div class="financeiro-label">Restante</div>
              <div class="financeiro-value">R$ ${booking.valorRestante.toFixed(2).replace('.', ',')}</div>
            </div>
          </div>
          ${booking.pagamentoId ? `
            <div style="margin-top: 10px; font-size: 12px; color: #6b7280;">
              <strong>ID Pagamento:</strong> ${booking.pagamentoId} | 
              <strong>Método:</strong> ${booking.metodoPagamento === 'pix' ? '📱 PIX' : booking.metodoPagamento === 'nubank' ? '💳 Nubank' : '💳 Cartão'}
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      ${booking.devolucaoPendente ? `
        <div class="devolucao-info devolucao-pendente">
          <strong>⚠️ Devolução Pendente:</strong> Aguardando confirmação de reembolso.
        </div>
      ` : ''}
      
      <div class="action-buttons">
        ${getActionButtons(booking)}
      </div>
    </div>
  `;
  }).join('');
}
window.renderBookings = window.renderBookings;

function getFinanceiroStatusLabel(status) {
  const labels = {
    'aguardando_pagamento': '🟡 AGUARDANDO SINAL',
    'pendente_confirmacao': '🟡 PAGAMENTO INFORMADO',
    'pago': '🟢 SINAL PAGO',
    'pagamento_recusado': '🔴 PAGAMENTO RECUSADO'
  };
  return labels[status] || status;
}
window.getFinanceiroStatusLabel = window.getFinanceiroStatusLabel;

function getStatusLabel(status) {
  const labels = {
    'pendente': '🟡 PENDENTE',
    'confirmado': '🟢 CONFIRMADO',
    'cancelado': '🔴 CANCELADO'
  };
  return labels[status] || status;
}
window.getStatusLabel = window.getStatusLabel;

function getActionButtons(booking) {
  let buttons = [];
  
  // Status PENDENTE: Botões de confirmar e cancelar
  if (booking.status === 'pendente') {
    buttons.push(`<button class="btn-action btn-confirm-sinal" onclick="confirmarAgendamento('${booking.id}')">
      ✅ Confirmar Agendamento
    </button>`);
    buttons.push(`<button class="btn-action btn-cancel-booking" onclick="cancelarAgendamentoAdmin('${booking.id}')">
      ❌ Cancelar Agendamento
    </button>`);
  }
  
  // Status CONFIRMADO: Botão principal de WhatsApp e cancelar secundário
  else if (booking.status === 'confirmado') {
    // Botão principal de WhatsApp (estilo WhatsApp)
    buttons.push(`<button class="btn-action btn-whatsapp-primary" onclick="enviarConfirmacaoCliente('${booking.id}')">
      📱 Enviar Confirmação p/ Cliente
    </button>`);
    
    // Botão de cancelar secundário (menor)
    buttons.push(`<button class="btn-action btn-cancel-small" onclick="cancelarAgendamentoAdmin('${booking.id}')">
      Cancelar Agendamento
    </button>`);
  }
  
  // Botão para confirmar sinal (status financeiro)
  if (booking.statusFinanceiro === 'pendente_confirmacao') {
    buttons.push(`<button class="btn-action btn-confirm-sinal" onclick="confirmarSinal('${booking.id}')">
      ✅ Confirmar Sinal
    </button>`);
  }
  
  // Botão para marcar como reembolsado (se estiver cancelado com devolução pendente)
  if (booking.status === 'cancelado' && booking.devolucaoPendente) {
    buttons.push(`<button class="btn-action btn-mark-refunded" onclick="marcarComoReembolsado('${booking.id}')">
      ✅ Marcar como Reembolsado
    </button>`);
  }
  
  // Botão de arquivar (3 pontos) para atendimentos concluídos ou cancelados antigos
  if (booking.status === 'confirmado' || booking.status === 'cancelado') {
    const bookingDate = new Date(booking.dateISO);
    const today = new Date();
    const isOld = bookingDate < new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); // Mais de 7 dias atrás
    
    if (isOld) {
      buttons.push(`<button class="btn-action btn-archive" onclick="arquivarAtendimento('${booking.id}')">
        ⋯ Arquivar
      </button>`);
    }
  }
  
  return buttons.join('');
}
window.getActionButtons = window.getActionButtons;

// Confirmar agendamento
window.confirmarAgendamento = async function(bookingId) {
  try {
    if (!bookingId || bookingId.trim() === '') {
      console.error('ID do agendamento inválido:', bookingId);
      return;
    }

    // Confirmar ação
    if (!confirm('Confirmar este agendamento? O status será atualizado para "Confirmado".')) {
      return;
    }

    // Atualizar status no Firebase
    const ref = doc(db, "agendamentos", bookingId);
    await updateDoc(ref, {
      status: 'confirmado',
      updatedAt: serverTimestamp()
    });

    // Recarregar lista
    await loadBookings();
    
    // Log de sucesso
    console.log(`Agendamento ${bookingId} confirmado`);
    
  } catch (error) {
    console.error('Erro ao confirmar agendamento:', error);
    alert('Erro ao confirmar agendamento. Tente novamente.');
  }
};
window.confirmarAgendamento = window.confirmarAgendamento;

// Cancelar agendamento do painel admin
window.cancelarAgendamentoAdmin = async function(bookingId) {
  try {
    if (!bookingId || bookingId.trim() === '') {
      console.error('ID do agendamento inválido:', bookingId);
      return;
    }

    // Confirmar ação
    if (!confirm('Deseja realmente cancelar este agendamento? O horário será liberado para novos agendamentos e uma mensagem será enviada para a cliente.')) {
      return;
    }

    const ref = doc(db, "agendamentos", bookingId);
    const bookingSnap = await getDoc(ref);
    const bookingData = bookingSnap.exists() ? bookingSnap.data() : null;

    // Atualizar status no Firebase
    await updateDoc(ref, {
      status: 'cancelado',
      updatedAt: serverTimestamp()
    });

    // Reativar slot no site removendo bloqueios administrativos deste horario (se houver)
    if (bookingData?.dateISO && bookingData?.hour) {
      await liberarHorarioBloqueado(bookingData.dateISO, bookingData.hour);
    }

    // Disparar mensagem de cancelamento usando função unificada
    await enviarMensagemStatus(bookingId, 'cancelar');

    // Recarregar lista
    await loadBookings();
    
    // Log de sucesso
    console.log(`Agendamento ${bookingId} cancelado com sucesso`);
    
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    alert('Erro ao cancelar agendamento. Tente novamente.');
  }
};
window.cancelarAgendamentoAdmin = window.cancelarAgendamentoAdmin;

// Função unificada para disparar mensagens via WhatsApp (Client-side com fallback robusto)
window.enviarMensagemStatus = async function(bookingId, tipo) {
  try {
    if (!bookingId || bookingId.trim() === '') {
      console.error('ID do agendamento inválido:', bookingId);
      return;
    }

    // Buscar dados completos do agendamento
    const bookingDoc = await doc(db, "agendamentos", bookingId);
    const bookingSnap = await getDoc(bookingDoc);
    
    if (!bookingSnap.exists()) {
      console.error('Agendamento não encontrado:', bookingId);
      alert('Agendamento não encontrado.');
      return;
    }
    
    const booking = bookingSnap.data();

    // Gerar mensagem baseada no tipo
    let mensagem = '';
    
    if (tipo === 'confirmar') {
      mensagem = `✨Seu horário está confirmado!✨

Agradeço imensamente pela confiança em meu trabalho.
Gentilmente, peço sua compreensão quanto à tolerância de até 10 minutos para o início do atendimento. Caso haja atraso superior a esse período, infelizmente não será possível realizar a decoração desejada.
É obrigatório que me envie com antecedência a decoração ou estilo escolhido. Caso não seja enviado, o procedimento será realizado sem decoração.
Será um prazer recebê-la 💖.

💅🏻 Serviço: ${booking.servico}
🗓️ Data: ${formatDateBR(booking.dateISO)}
⏰ Horário: ${booking.hour}
📍 Endereço: Rua Olinto Magalhães, 1628, BH

📞 Dúvidas? (31) 99362-7475`;
    } else if (tipo === 'cancelar') {
      mensagem = `Olá gatona, tudo bem? 

O horário que você selecionou infelizmente já não está mais disponível e teve que ser cancelado.
Mas fico à disposição para te ajudar a encontrar um novo horário que se encaixe melhor na sua agenda.

Me informe sua disponibilidade que terei o maior prazer em te atender`;
    }

    // Tratamento robusto de número de telefone - remover todos os caracteres não numéricos
    let clientPhone = booking.celular;
    if (!clientPhone) {
      throw new Error('Número de telefone não encontrado no agendamento');
    }
    
    // Remover formatação: (31) 98765-4321 -> 31987654321
    clientPhone = clientPhone.replace(/\D/g, '');
    
    // Garantir que tenha o prefixo 55 (Brasil)
    if (!clientPhone.startsWith('55')) {
      clientPhone = `55${clientPhone}`;
    }
    
    // Validar número (deve ter entre 12 e 13 dígitos com o 55)
    if (clientPhone.length < 12 || clientPhone.length > 13) {
      throw new Error(`Número de telefone inválido: ${booking.celular}`);
    }

    // Abrir WhatsApp com fallback robusto para popup blockers
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${clientPhone}&text=${encodeURIComponent(mensagem)}`;
    
    try {
      // Tentar abrir em nova aba (desktop)
      const newWindow = window.open(whatsappUrl, "_blank", "noopener");
      
      // Verificar se a janela foi aberta com sucesso
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        throw new Error('Popup bloqueado');
      }
      
    } catch (popupError) {
      console.log('window.open bloqueado, usando fallback para redirecionamento direto');
      
      // Fallback 1: tentar redirecionamento direto
      try {
        window.location.href = whatsappUrl;
      } catch (redirectError) {
        console.error('Erro no redirecionamento direto:', redirectError);
        
        // Fallback 2: redirecionamento simples
        try {
          window.location.href = `https://api.whatsapp.com/send?phone=${clientPhone}`;
        } catch (finalError) {
          console.error('Erro no fallback final:', finalError);
          
          // Último recurso: copiar número para clipboard
          try {
            await navigator.clipboard.writeText(clientPhone);
            alert(`Número copiado para área de transferência: ${clientPhone}\nPor favor, cole no WhatsApp manualmente.`);
          } catch (clipboardError) {
            alert(`WhatsApp não pôde ser aberto. Contate o cliente pelo número: ${clientPhone}`);
          }
        }
      }
    }

    // Log de sucesso
    console.log(`WhatsApp ${tipo} aberto para ${clientPhone} - Agendamento ${bookingId}`);
    
  } catch (error) {
    console.error(`Erro ao enviar mensagem ${tipo}:`, error);
    alert(`Erro ao enviar mensagem: ${error.message}. Tente novamente.`);
  }
};
window.enviarMensagemStatus = window.enviarMensagemStatus;

// Enviar confirmação para cliente via WhatsApp (função legada para compatibilidade)
window.enviarConfirmacaoCliente = async function(bookingId) {
  await enviarMensagemStatus(bookingId, 'confirmar');
};
window.enviarConfirmacaoCliente = window.enviarConfirmacaoCliente;

// Arquivar atendimento (envia para histórico mas não exclui permanentemente)
window.arquivarAtendimento = async function(bookingId) {
  try {
    if (!bookingId || bookingId.trim() === '') {
      console.error('ID do agendamento inválido:', bookingId);
      return;
    }

    // Confirmar ação
    if (!confirm('Deseja arquivar este atendimento? Ele será movido para o histórico e não aparecerá mais na lista principal.')) {
      return;
    }

    // Atualizar status no Firebase (arquivar em vez de excluir)
    const ref = doc(db, "agendamentos", bookingId);
    await updateDoc(ref, {
      arquivado: true,
      dataArquivamento: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Recarregar lista
    await loadBookings();
    
    // Log de sucesso
    console.log(`Atendimento ${bookingId} arquivado com sucesso`);
    
  } catch (error) {
    console.error('Erro ao arquivar atendimento:', error);
    alert('Erro ao arquivar atendimento. Tente novamente.');
  }
};
window.arquivarAtendimento = window.arquivarAtendimento;

// Confirmar sinal de pagamento
window.confirmarSinal = async function(bookingId) {
  try {
    if (!bookingId || bookingId.trim() === '') {
      console.error('ID do agendamento inválido:', bookingId);
      return;
    }

    // Confirmar ação
    if (!confirm('Confirmar o sinal deste agendamento? O status será atualizado para "Sinal Pago".')) {
      return;
    }

    const ref = doc(db, "agendamentos", bookingId);
    await updateDoc(ref, {
      statusFinanceiro: 'pago',
      updatedAt: serverTimestamp()
    });

    // Recarregar lista
    await loadBookings();
    
    // Log de sucesso
    console.log(`Sinal confirmado para agendamento ${bookingId}`);
    
  } catch (error) {
    console.error('Erro ao confirmar sinal:', error);
    alert('Erro ao confirmar sinal. Tente novamente.');
  }
};
window.confirmarSinal = window.confirmarSinal;

// Cancelar agendamento
window.cancelarAgendamento = async function(bookingId) {
  try {
    if (!bookingId || bookingId.trim() === '') {
      console.error('ID do agendamento inválido:', bookingId);
      return;
    }

    // Confirmar ação
    if (!confirm('Deseja realmente cancelar este agendamento? O horário será liberado no site e uma devolução será marcada como pendente.')) {
      return;
    }

    const ref = doc(db, "agendamentos", bookingId);
    const bookingSnap = await getDoc(ref);
    const bookingData = bookingSnap.exists() ? bookingSnap.data() : null;
    await updateDoc(ref, {
      status: 'cancelado',
      devolucaoPendente: true,
      updatedAt: serverTimestamp()
    });

    if (bookingData?.dateISO && bookingData?.hour) {
      await liberarHorarioBloqueado(bookingData.dateISO, bookingData.hour);
    }

    // Recarregar lista
    await loadBookings();
    
    // Log de sucesso
    console.log(`Agendamento ${bookingId} cancelado com devolução pendente`);
    
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    alert('Erro ao cancelar agendamento. Tente novamente.');
  }
};
window.cancelarAgendamento = window.cancelarAgendamento;

async function liberarHorarioBloqueado(dateISO, hour) {
  try {
    const q = query(
      collection(db, "horarios_bloqueados"),
      where("dateISO", "==", dateISO),
      where("hour", "==", hour)
    );
    const snap = await getDocs(q);
    const deletes = [];
    snap.forEach((d) => deletes.push(deleteDoc(doc(db, "horarios_bloqueados", d.id))));
    await Promise.all(deletes);
  } catch (error) {
    console.error("Erro ao liberar horario bloqueado:", error);
  }
}

// Marcar como reembolsado
window.marcarComoReembolsado = async function(bookingId) {
  try {
    if (!bookingId || bookingId.trim() === '') {
      console.error('ID do agendamento inválido:', bookingId);
      return;
    }

    // Confirmar ação
    if (!confirm('Marcar este agendamento como reembolsado? Esta ação serve para controle interno da devolução manual.')) {
      return;
    }

    const ref = doc(db, "agendamentos", bookingId);
    await updateDoc(ref, {
      devolucaoPendente: false,
      reembolsadoEm: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Recarregar lista
    await loadBookings();
    
    // Log de sucesso
    console.log(`Agendamento ${bookingId} marcado como reembolsado`);
    
  } catch (error) {
    console.error('Erro ao marcar como reembolsado:', error);
    alert('Erro ao marcar como reembolsado. Tente novamente.');
  }
};
window.marcarComoReembolsado = window.marcarComoReembolsado;

// Atualizar status do agendamento
window.updateBookingStatus = async function(bookingId, newStatus) {
  try {
    // Validação do documento
    if (!bookingId || bookingId.trim() === '') {
      console.error('ID do agendamento inválido:', bookingId);
      return;
    }
    
    const ref = doc(db, "agendamentos", bookingId);
    
    // Verifica se o documento existe antes de atualizar
    const docSnap = await getDoc(ref);
    if (!docSnap.exists()) {
      console.error('Agendamento não encontrado:', bookingId);
      alert('Agendamento não encontrado no sistema.');
      return;
    }
    
    await updateDoc(ref, {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    
    // Remove o alert e apenas recarrega a lista
    await loadBookings(); // Recarrega a lista automaticamente
    
    console.log(`Agendamento ${bookingId} atualizado para ${newStatus}`);
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    console.error('Detalhes do erro:', error.code, error.message);
    
    // Mensagem de erro mais específica
    if (error.code === 'permission-denied') {
      alert('Erro: Sem permissão para atualizar este agendamento.');
    } else if (error.code === 'not-found') {
      alert('Erro: Agendamento não encontrado.');
    } else {
      alert(`Erro ao atualizar status: ${error.message || 'Erro desconhecido'}`);
    }
  }
};
window.updateBookingStatus = window.updateBookingStatus;

// 🔧 FUNÇÃO AUXILIAR: Eventos compatíveis com Mobile e Desktop
function addMobileCompatibleEvent(element, eventType, handler) {
  if (!element) {
    console.error('❌ Elemento não encontrado para evento:', element);
    return;
  }
  
  console.log(`🔧 Adicionando evento ${eventType} ao elemento:`, element);
  
  // Adicionar eventos para desktop e mobile
  element.addEventListener('click', (e) => {
    console.log(`🖱️ Evento click disparado em:`, element);
    handler(e);
  });
  
  element.addEventListener('touchstart', function(e) {
    console.log(`📱 Evento touchstart disparado em:`, element);
    e.preventDefault(); // Evitar duplo clique em mobile
    handler(e);
  }, { passive: false });
}
window.addMobileCompatibleEvent = window.addMobileCompatibleEvent;

// 📱 FUNÇÃO: Otimização para Mobile/Touch
function optimizeForMobile() {
  console.log('📱 Otimizando interface para dispositivos móveis...');
  
  // Adicionar CSS animation para spinner se não existir
  if (!document.querySelector('#spinner-animation')) {
    const style = document.createElement('style');
    style.id = 'spinner-animation';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      /* Melhorias para touch em mobile */
      @media (max-width: 768px) {
        .btn-action, .filter-btn, .menu-item {
          min-height: 48px;
          min-width: 48px;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          -webkit-user-select: none;
        }
        
        .side-menu {
          width: 85%;
          max-width: 300px;
        }
        
        .modal-content {
          width: 95%;
          margin: 10px;
        }
        
        /* Prevenir zoom em inputs */
        input, select, textarea {
          font-size: 16px !important;
        }
      }
      
      /* iOS Safari specific fixes */
      @supports (-webkit-touch-callout: none) {
        .btn-action, .filter-btn, .menu-item {
          -webkit-appearance: none;
          -webkit-border-radius: 0;
        }
      }
    `;
    document.head.appendChild(style);
    console.log('✅ Estilos mobile otimizados adicionados');
  }
}
window.optimizeForMobile = window.optimizeForMobile;

// 🎯 FUNÇÃO: Feedback visual com loading spinner
function showLoadingSpinner(elementId, message = 'Processando...') {
  console.log(`🔄 Criando spinner para: ${elementId}`);
  
  // Remover spinner existente se houver
  hideLoadingSpinner(elementId);
  
  const spinner = document.createElement('div');
  spinner.id = `${elementId}-spinner`;
  spinner.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 20px 30px;
    border-radius: 12px;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 15px;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    backdrop-filter: blur(10px);
  `;
  
  spinner.innerHTML = `
    <div style="
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top: 3px solid var(--dourado);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    "></div>
    <span>${message}</span>
  `;
  
  document.body.appendChild(spinner);
  console.log(`🔄 Spinner mostrado: ${message}`);
  
  // Timeout de segurança para remover spinner após 30 segundos
  setTimeout(() => {
    hideLoadingSpinner(elementId);
  }, 30000);
}
window.showLoadingSpinner = window.showLoadingSpinner;

function hideLoadingSpinner(elementId) {
  const spinner = document.getElementById(`${elementId}-spinner`);
  if (spinner && spinner.parentNode) {
    spinner.parentNode.removeChild(spinner);
    console.log(`✅ Spinner ocultado para: ${elementId}`);
  }
}
window.hideLoadingSpinner = window.hideLoadingSpinner;

// 🚀 INICIALIZAÇÃO: Otimizações Mobile ao carregar
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM carregado, aplicando otimizações...');
  optimizeForMobile();
  
  // Detectar dispositivo mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    console.log('📱 Dispositivo mobile detectado, aplicando configurações específicas...');
    document.body.classList.add('mobile-device');
  }
});

// 📅 FUNÇÃO: Calcular dinamicamente início e fim do mês
function getMonthRange(date = new Date()) {
  const inicioMes = new Date(date.getFullYear(), date.getMonth(), 1);
  const fimMes = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  fimMes.setHours(23, 59, 59, 999);
  
  console.log(`📅 Range do mês: ${inicioMes.toISOString().split('T')[0]} até ${fimMes.toISOString().split('T')[0]}`);
  
  return { inicioMes, fimMes };
}
window.getMonthRange = window.getMonthRange;

// Event listeners dos filtros com suporte mobile
document.querySelectorAll('.filter-btn').forEach(btn => {
  addMobileCompatibleEvent(btn, 'click', () => {
    console.log(`🔍 Filtro selecionado: ${btn.dataset.filter}`);
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    filterBookings();
  });
});

// Funções de Bloqueio de Horários
window.blockTimeSlot = async function() {
  try {
    const date = blockDate.value;
    const hour = blockHour.value;
    
    if (!date || !hour) {
      alert('Por favor, selecione uma data e um horário para bloquear.');
      return;
    }

    if (!confirm(`Deseja bloquear o horário ${hour} do dia ${formatDateBR(date)}?`)) {
      return;
    }

    // Salvar bloqueio como agendamento real na coleção agendamentos
    const docRef = await addDoc(collection(db, "agendamentos"), {
      nome: "HORÁRIO BLOQUEADO",
      celular: "00000000000",
      servico: "Bloqueio Administrativo",
      dateISO: date,
      hour: hour,
      status: "bloqueado",
      statusFinanceiro: "bloqueado",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      blockedBy: 'admin'
    });

    // Limpar campos
    blockDate.value = '';
    blockHour.value = '';

    // Recarregar lista
    await loadBookings();
    
    alert('Horário bloqueado com sucesso!');
    console.log(`Horário bloqueado como agendamento: ${date} ${hour}`);
    
  } catch (error) {
    console.error('Erro ao bloquear horário:', error);
    alert('Erro ao bloquear horário. Tente novamente.');
  }
};
window.blockTimeSlot = window.blockTimeSlot;

window.unblockTimeSlot = async function() {
  try {
    const date = blockDate.value;
    const hour = blockHour.value;
    
    if (!date || !hour) {
      alert('Por favor, selecione uma data e um horário para desbloquear.');
      return;
    }

    if (!confirm(`Deseja desbloquear o horário ${hour} do dia ${formatDateBR(date)}?`)) {
      return;
    }

    // Buscar e remover agendamento bloqueado na coleção agendamentos
    const q = query(
      collection(db, "agendamentos"),
      where("dateISO", "==", date),
      where("hour", "==", hour),
      where("nome", "==", "HORÁRIO BLOQUEADO")
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      alert('Nenhum bloqueio encontrado para este horário.');
      return;
    }

    // Remover todos os agendamentos bloqueados encontrados
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Limpar campos
    blockDate.value = '';
    blockHour.value = '';

    // Recarregar lista
    await loadBookings();
    
    alert('Horário desbloqueado com sucesso!');
    console.log(`Horário desbloqueado: ${date} ${hour}`);
    
  } catch (error) {
    console.error('Erro ao desbloquear horário:', error);
    alert('Erro ao desbloquear horário. Tente novamente.');
  }
};
window.unblockTimeSlot = window.unblockTimeSlot;

// 🚀 EVENT LISTENERS DO MENU FERRAMENTAS (Refatorado com async/await)

// Botão Sync/Recovery
addMobileCompatibleEvent(btnSyncRecovery, 'click', async () => {
  try {
    console.log('🔄 Botão Sync/Recovery pressionado');
    showLoadingSpinner('sync-recovery', 'Sincronizando dados...');
    
    await window.syncRecoveryAgendamentos();
    
    hideLoadingSpinner('sync-recovery');
    console.log('✅ Sync/Recovery concluído com sucesso');
    
  } catch (error) {
    hideLoadingSpinner('sync-recovery');
    console.error('❌ Erro no Sync/Recovery:', error);
    alert(`Erro na sincronização: ${error.message}`);
  }
});

// Botão Limpar Histórico
addMobileCompatibleEvent(btnCleanHistory, 'click', async () => {
  try {
    console.log('🗑️ Botão Limpar Histórico pressionado');
    showLoadingSpinner('clean-history', 'Limpando agendamentos antigos...');
    
    await window.cleanOldBookings();
    
    hideLoadingSpinner('clean-history');
    console.log('✅ Limpeza concluída com sucesso');
    
  } catch (error) {
    hideLoadingSpinner('clean-history');
    console.error('❌ Erro na limpeza:', error);
    alert(`Erro na limpeza: ${error.message}`);
  }
});

// --- PASSO 1: DECLARE A FUNÇÃO PRIMEIRO ---
const loadHistory = async () => {
    console.log("Iniciando carregamento do histórico...");
    try {
        showLoadingSpinner('view-history', 'Carregando histórico...');
        
        // Buscar todos os agendamentos onde arquivado === true OU status === 'cancelado'
        const historicoQuery = query(
            collection(db, "agendamentos"),
            or(
                where("arquivado", "==", true),
                where("status", "==", "cancelado")
            ),
            orderBy("updatedAt", "desc")
        );
        
        const historicoSnapshot = await getDocs(historicoQuery);
        const allHistoryItems = [];
        
        historicoSnapshot.forEach((doc) => {
            const booking = doc.data();
            const isArquivado = booking.arquivado === true;
            const isCancelado = booking.status === 'cancelado';
            
            // Determinar o tipo e data de movimento
            let tipo = '';
            let dataMovimento = new Date();
            let origem = '';
            
            if (isArquivado) {
                tipo = 'arquivado';
                dataMovimento = booking.dataArquivamento?.toDate() || booking.updatedAt?.toDate() || new Date();
                origem = 'Arquivado automaticamente';
            } else if (isCancelado) {
                tipo = 'cancelado';
                dataMovimento = booking.updatedAt?.toDate() || booking.createdAt?.toDate() || new Date();
                origem = 'Cancelado';
            }
            
            allHistoryItems.push({
                ...booking,
                id: doc.id,
                tipo: tipo,
                dataMovimento: dataMovimento,
                origem: origem
            });
        });
        
        // Ordenar por data de movimento (mais recente primeiro)
        allHistoryItems.sort((a, b) => b.dataMovimento - a.dataMovimento);
        
        if (allHistoryItems.length === 0) {
            historyList.innerHTML = '<p style="text-align: center; color: #6b7280;">Nenhum agendamento no histórico.</p>';
        } else {
            let historyHTML = '<div class="history-grid">';
            
            allHistoryItems.forEach((item) => {
                const statusLabel = getStatusLabel(item.status);
                const dataMovimentoFormatada = item.dataMovimento.toLocaleDateString('pt-BR');
                
                historyHTML += `
                    <div class="history-item ${item.tipo === 'arquivado' ? 'arquivado-item' : 'cancelado-item'}">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h4 style="margin: 0; color: var(--preto);">${item.nome}</h4>
                        <div style="text-align: right;">
                          <span style="font-size: 0.7rem; color: #6b7280;">
                            ${item.origem}
                          </span><br>
                          <span style="font-size: 0.8rem; color: #6b7280; font-weight: bold;">
                            ${dataMovimentoFormatada}
                          </span>
                        </div>
                      </div>
                      <div class="booking-info">
                        <div class="info-item">
                          <span class="info-label">📅 Data:</span>
                          <span class="info-value">${formatDateBR(item.dateISO)}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">⏰ Horário:</span>
                          <span class="info-value">${item.hour}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">💅 Serviço:</span>
                          <span class="info-value">${item.servico}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">📱 Celular:</span>
                          <span class="info-value">${item.celular}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">📊 Status:</span>
                          <span class="info-value">${statusLabel}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">🗃️ Tipo:</span>
                          <span class="info-value" style="color: ${item.tipo === 'arquivado' ? '#6c757d' : '#dc3545'};">
                            ${item.tipo === 'arquivado' ? 'Arquivado' : 'Cancelado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  `;
            });
            
            historyHTML += '</div>';
            historyList.innerHTML = historyHTML;
        }
        
        // Exibir o modal
        const historyModal = document.getElementById('historyModal');
        if (historyModal) {
            historyModal.classList.add('open');
        }
        
        console.log(`✅ Histórico carregado: ${allHistoryItems.length} itens`);
        
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        historyList.innerHTML = '<p style="text-align: center; color: #dc3545;">Erro ao carregar histórico.</p>';
    } finally {
        hideLoadingSpinner('view-history');
    }
};

// --- PASSO 2: AGORA O EVENTO PODE ENCONTRAR A FUNÇÃO ---
// Agora que loadHistory já foi criada logo acima, o código vai funcionar
addMobileCompatibleEvent(btnViewHistory, 'click', loadHistory);

addMobileCompatibleEvent(closeHistoryModal, 'click', () => {
    const historyModal = document.getElementById('historyModal');
    if (historyModal) {
        historyModal.classList.remove('open');
    }
});

// Botão Exportar Dados
addMobileCompatibleEvent(btnExportData, 'click', async () => {
  try {
    console.log('📥 Botão Exportar Dados pressionado');
    showLoadingSpinner('export-data', 'Exportando dados...');
    
    await window.exportData();
    
    hideLoadingSpinner('export-data');
    console.log('✅ Exportação concluída com sucesso');
    
  } catch (error) {
    hideLoadingSpinner('export-data');
    console.error('❌ Erro na exportação:', error);
    alert(`Erro na exportação: ${error.message}`);
  }
});

// Event listeners para botões de bloqueio com suporte mobile
addMobileCompatibleEvent(btnBlockTime, 'click', async () => {
  try {
    console.log('🚫 Botão Bloquear Horário pressionado');
    showLoadingSpinner('block-time', 'Bloqueando horário...');
    
    await window.blockTimeSlot();
    
    hideLoadingSpinner('block-time');
    console.log('✅ Horário bloqueado com sucesso');
    
  } catch (error) {
    hideLoadingSpinner('block-time');
    console.error('❌ Erro ao bloquear horário:', error);
    alert(`Erro ao bloquear horário: ${error.message}`);
  }
});

addMobileCompatibleEvent(btnUnblockTime, 'click', async () => {
  try {
    console.log('✅ Botão Desbloquear Horário pressionado');
    showLoadingSpinner('unblock-time', 'Desbloqueando horário...');
    
    await window.unblockTimeSlot();
    
    hideLoadingSpinner('unblock-time');
    console.log('✅ Horário desbloqueado com sucesso');
    
  } catch (error) {
    hideLoadingSpinner('unblock-time');
    console.error('❌ Erro ao desbloquear horário:', error);
    alert(`Erro ao desbloquear horário: ${error.message}`);
  }
});

// Menu hambúrguer com suporte mobile
addMobileCompatibleEvent(menuToggle, 'click', () => {
  console.log('🍔 Menu hambúrguer aberto');
  sideMenu.classList.add('open');
});

addMobileCompatibleEvent(closeMenu, 'click', () => {
  console.log('❌ Menu hambúrguer fechado');
  sideMenu.classList.remove('open');
});

// Modal de histórico com suporte mobile
addMobileCompatibleEvent(closeHistoryModal, 'click', () => {
  console.log('📊 Modal de histórico fechado');
  historyModal.classList.remove('open');
});

// Função para limpeza automática inteligente (arquivamento)
window.cleanOldBookings = async function() {
  try {
    if (!confirm('Deseja arquivar todos os agendamentos antigos? Eles ficarão ocultos na lista principal mas ficarão acessíveis no histórico.')) {
      return;
    }

    const agora = new Date();
    const q = query(collection(db, "agendamentos"));
    const querySnapshot = await getDocs(q);
    
    let archivedCount = 0;
    
    for (const docSnapshot of querySnapshot.docs) {
      const booking = docSnapshot.data();
      const bookingDateTime = new Date(`${booking.dateISO}T${booking.hour}:00`);
      
      // Critérios para arquivamento automático:
      // 1. Agendamentos passados (mais de 24h atrás)
      // 2. Não arquivados ainda
      // 3. Status confirmado ou cancelado (não pendentes)
      const isOld = bookingDateTime < new Date(agora.getTime() - 24 * 60 * 60 * 1000);
      const isNotArchived = !booking.arquivado;
      const isCompleted = booking.status === 'confirmado' || booking.status === 'cancelado';
      
      if (isOld && isNotArchived && isCompleted) {
        // Arquivar em vez de mover
        await updateDoc(docSnapshot.ref, {
          arquivado: true,
          dataArquivamento: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        archivedCount++;
      }
    }
    
    // Recarregar lista
    await loadBookings();
    
    alert(`${archivedCount} agendamentos arquivados com sucesso!`);
    console.log(`Limpeza automática concluída: ${archivedCount} agendamentos arquivados`);
    
  } catch (error) {
    console.error('Erro ao limpar agendamentos antigos:', error);
    alert('Erro ao limpar agendamentos antigos. Tente novamente.');
  }
};
window.cleanOldBookings = window.cleanOldBookings;

// 🌐 GARANTINDO ESCOPO GLOBAL EXPLÍCITO PARA HTML
window.cleanOldBookings = window.cleanOldBookings; // Garante que HTML enxergue a função

// 🗑️ FUNÇÃO DUPLICADA REMOVIDA: loadHistory (movida para o topo com implementação completa)

// �️ FUNÇÃO DUPLICADA REMOVIDA: exportData (movida para o topo)

// 🔄 AUTO-RECARGAMENTO INTELIGENTE (Modernizado)
const autoRefreshInterval = setInterval(() => {
  if (!loginSection.classList.contains('hidden')) {
    console.log('🔄 Auto-recarregamento agendamentos...');
    loadBookings();
  }
}, 30000);

// 🛑 LIMPEZA DE RECURSOS AO SAIR DA PÁGINA
window.addEventListener('beforeunload', () => {
  console.log('🧹 Limpando recursos antes de sair...');
  if (realtimeListener) {
    realtimeListener();
  }
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
});

// 📱 DETECÇÃO DE ORIENTAÇÃO MOBILE
window.addEventListener('orientationchange', () => {
  console.log('📱 Orientação do dispositivo alterada');
  setTimeout(() => {
    // Reaplicar otimizações mobile após mudança de orientação
    optimizeForMobile();
  }, 100);
});

// 🌐 FORÇAR ESCOPO GLOBAL - GARANTIR QUE HTML ENCONTRE AS FUNÇÕES
// Inserido no final do arquivo para garantir escopo global absoluto
window.loadHistory = loadHistory;
window.syncRecoveryAgendamentos = syncRecoveryAgendamentos;
window.cleanOldBookings = cleanOldBookings;
window.exportData = exportData;
window.blockTimeSlot = blockTimeSlot;
window.unblockTimeSlot = unblockTimeSlot;

console.log('✅ Escopo global forçado aplicado - Funções disponíveis para HTML');
