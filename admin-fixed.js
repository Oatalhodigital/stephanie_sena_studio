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

// 🚀 FUNÇÕES GLOBAIS DO MENU FERRAMENTAS (Definidas no topo para garantir escopo global)

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

// 📅 FUNÇÕES DE DATA (Modernizadas ES6+)
const formatDateBR = (isoDate) => {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
};

const isToday = (dateISO) => {
  const today = new Date().toISOString().split('T')[0];
  return dateISO === today;
};

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

// Funções auxiliares (continua o resto do código original...)
// [O resto do código permanece o mesmo]

console.log('✅ Admin.js carregado com funções globais definidas!');
