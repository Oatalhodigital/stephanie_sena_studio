import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  runTransaction,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const STUDIO_WHATSAPP = "5531993627475";
const HOUR_START = 8;
const HOUR_END = 20;
const WEBHOOK_URL = ""; // opcional: URL do Make/Zapier para enviar notificacoes automáticas

// Estados possíveis para agendamento
const AGENDAMENTO_STATUS = {
  PENDENTE: 'pendente',
  CONFIRMADO: 'confirmado', 
  CANCELADO: 'cancelado'
};

// Estados financeiros
const STATUS_FINANCEIRO = {
  AGUARDANDO_PAGAMENTO: 'aguardando_pagamento',
  PENDENTE_CONFIRMACAO: 'pendente_confirmacao',
  PAGO: 'pago',
  PAGAMENTO_RECUSADO: 'pagamento_recusado'
};

// Função para extrair valor do serviço e calcular 30%
function calcularValoresServico(servico) {
  const precos = {
    'Alongamento em gel': 140.00,
    'Manutenção até 15 dias': 65.00,
    'Manutenção mais de 25 dias': 85.00,
    'Blindagem': 50.00,
    'Banho em gel': 100.00,
    'Esmaltação em gel': 35.00,
    'Encapsulada': 0, // Valores adicionais - será tratado separadamente
    'Babyboomer': 0   // Valores adicionais - será tratado separadamente
  };

  const valorTotal = precos[servico] || 0;
  const valorSinal = valorTotal * 0.3; // 30% do valor total
  const valorRestante = valorTotal - valorSinal;

  return {
    valorTotal,
    valorSinal,
    valorRestante
  };
}

const state = {
  db: null,
  firebaseReady: false,
  mode: "firebase",
  selectedDate: "",
  selectedSlot: "",
  activeUnsubscribe: null,
  reconnectTimer: null,
  selectedBooking: null
};

const el = {
  leadForm: document.getElementById("leadForm"),
  nome: document.getElementById("nome"),
  celular: document.getElementById("celular"),
  servico: document.getElementById("servico"),
  dataAgendamento: document.getElementById("dataAgendamento"),
  slotsGrid: document.getElementById("slotsGrid"),
  btnConfirmarSlot: document.getElementById("btnConfirmarSlot"),
  btnConfirmarWhats: document.getElementById("btnConfirmarWhats"),
  btnCancelarAgendamento: document.getElementById("btnCancelarAgendamento"),
  agendamentoInfo: document.getElementById("agendamentoInfo"),
  agendamentoInfoTitulo: document.getElementById("agendamentoInfoTitulo"),
  agendamentoInfoTexto: document.getElementById("agendamentoInfoTexto"),
  mentoriaForm: document.getElementById("mentoriaForm"),
  mentoriaNome: document.getElementById("mentoriaNome"),
  // Modal de pagamento
  paymentModal: document.getElementById("paymentModal"),
  closePaymentModal: document.getElementById("closePaymentModal"),
  paymentServico: document.getElementById("paymentServico"),
  paymentData: document.getElementById("paymentData"),
  paymentHora: document.getElementById("paymentHora"),
  paymentValorTotal: document.getElementById("paymentValorTotal"),
  paymentValorSinal: document.getElementById("paymentValorSinal"),
  paymentValorRestante: document.getElementById("paymentValorRestante"),
  pixTab: document.getElementById("pixTab"),
  pixPayment: document.getElementById("pixPayment"),
  qrCode: document.getElementById("qrCode"),
  pixCode: document.getElementById("pixCode"),
  copyPixCode: document.getElementById("copyPixCode"),
  confirmPayment: document.getElementById("confirmPayment"),
  cancelPayment: document.getElementById("cancelPayment"),
  paymentStatus: document.getElementById("paymentStatus")
};

function reveal() {
  const reveals = document.querySelectorAll(".reveal");
  reveals.forEach((item) => {
    const windowHeight = window.innerHeight;
    const elementTop = item.getBoundingClientRect().top;
    if (elementTop < windowHeight - 100) item.classList.add("active");
  });
}

function normalizePhone(v) {
  // Remove todos os caracteres não numéricos
  let phone = (v || "").replace(/\D+/g, "");
  
  // Verifica se é o número antigo e substitui
  if (phone === "5531991705308") {
    phone = "5531993627475";
  }
  
  return phone;
}

function todayStr() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatDateBR(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function slotId(dateISO, hour) {
  return `${dateISO}_${hour}`;
}

function createHourSlots(selectedDate) {
  // CORREÇÃO DEFINITIVA: Usar new Date(selectedDate + 'T00:00:00') para evitar problemas de fuso horário
  // Isso garante que o dia da semana seja interpretado corretamente no fuso local
  const date = new Date(selectedDate + 'T00:00:00');
  const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado
  
  // MATRIZ DE HORÁRIOS POR DIA DA SEMANA (conforme especificado)
  // BLOQUEIO DE SEGUNDAS-FEIRAS: Removido completamente (folga da profissional)
  // REMOÇÃO DE HORÁRIO DE ALMOÇO (12:30): Removido de Terça a Sábado
  const weeklySchedule = {
    0: [], // Domingo: Nenhum horário disponível (folga)
    1: [], // Segunda: Nenhum horário disponível (folga da profissional)
    2: ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00"], // Terça (sem 12:30 - almoço)
    3: ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00"], // Quarta (sem 12:30 - almoço)
    4: ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00"], // Quinta (sem 12:30 - almoço)
    5: ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00", "18:30"], // Sexta (sem 12:30 - almoço)
    6: ["08:00", "09:30", "11:00", "14:00", "15:30", "17:00", "18:30"]  // Sábado (sem 12:30 - almoço)
  };
  
  // Retorna os horários para o dia da semana específico
  // Os horários já estão em ordem cronológica crescente no array
  return weeklySchedule[dayOfWeek] || [];
}

// Função de rastreamento Google Analytics
function trackEvent(eventName, parameters = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, parameters);
  }
}

// Função específica para clique no botão de agendamento
function trackAgendamentoClick() {
  trackEvent('clique_agendamento_whatsapp', {
    event_category: 'engagement',
    event_label: 'botao_confirmar_agendamento',
    value: 1
  });
}

function setInfo(type, title, text) {
  if (!el.agendamentoInfo) return;
  el.agendamentoInfo.classList.remove("hidden", "info-ok", "info-warn", "info-error");
  el.agendamentoInfo.classList.add(type);
  el.agendamentoInfoTitulo.textContent = title;
  el.agendamentoInfoTexto.textContent = text;
}

async function getFirebaseConfig() {
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyA_6I9MmZ_B6hb0QwqewYyciDIpdAAK9D0",
      authDomain: "studio-stephanie-sena.firebaseapp.com",
      projectId: "studio-stephanie-sena",
      storageBucket: "studio-stephanie-sena.firebasestorage.app",
      messagingSenderId: "697438120393",
      appId: "1:697438120393:web:b586bef9902f767684e018",
      measurementId: "G-T2XMTXZ81M"
    };
    return firebaseConfig;
  } catch (error) {
    // sem config local
  }
  return null;
}

async function initFirebase() {
  try {
    const firebaseConfig = await getFirebaseConfig();
    if (!firebaseConfig) {
      throw new Error("Configuração do Firebase não encontrada");
    }

    const app = initializeApp(firebaseConfig);
    state.db = getFirestore(app);
    state.firebaseReady = true;
    state.mode = "firebase";
    disableScheduler(false);
    setInfo("info-ok", "Sistema online", "Agendamento em tempo real ativo. Escolha data e horário para reservar.");
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
    setInfo("info-error", "Erro de conexão", "Não foi possível conectar ao Firebase. Tente recarregar a página.");
  }
}

function disableScheduler(disabled) {
  if (el.nome) el.nome.disabled = disabled;
  if (el.celular) el.celular.disabled = disabled;
  if (el.dataAgendamento) el.dataAgendamento.disabled = disabled;
  if (el.btnConfirmarSlot) el.btnConfirmarSlot.disabled = disabled;
}

function renderSlots(bookedHourList) {
  if (!el.slotsGrid) return;
  const selected = state.selectedSlot;
  const booked = new Set(bookedHourList || []);
  const slots = createHourSlots(state.selectedDate);

  el.slotsGrid.innerHTML = "";
  slots.forEach((hour) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot-btn";
    b.textContent = hour;
    b.dataset.hour = hour;

    if (booked.has(hour)) {
      b.classList.add("is-booked");
      b.disabled = true;
      b.title = "Horário já reservado";
    } else if (hour === selected) {
      b.classList.add("is-selected");
    }
    el.slotsGrid.appendChild(b);
  });
}

function clearRealtimeSubscription() {
  if (typeof state.activeUnsubscribe === "function") {
    state.activeUnsubscribe();
    state.activeUnsubscribe = null;
  }
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
}

async function subscribeDay(dateISO) {
  if (!dateISO) return;

  // Força uso do Firebase - sem fallback para localStorage
  if (!state.firebaseReady || !state.db) {
    console.error('Firebase não está pronto para inscrição em tempo real');
    renderSlots([]);
    return;
  }

  // LIMPEZA DE LISTENERS ANTERIORES - Prevenção de memory leak
  clearRealtimeSubscription();
  
  // Buscar agendamentos e horários bloqueados simultaneamente
  const agendamentosQuery = query(collection(state.db, "agendamentos"), where("dateISO", "==", dateISO));
  const bloqueadosQuery = query(collection(state.db, "horarios_bloqueados"), where("dateISO", "==", dateISO));
  
  // Listener para agendamentos com tratamento de erro robusto
  const agendamentosUnsubscribe = onSnapshot(
    agendamentosQuery,
    async (agendamentosSnapshot) => {
      try {
        const booked = [];
        agendamentosSnapshot.forEach((d) => {
          const row = d.data();
          // CORREÇÃO CRÍTICA: Horários cancelados DEVEM ser liberados imediatamente
          // Apenas status 'confirmado', 'pendente' e 'bloqueado' ocupam o horário
          // Status 'cancelado' libera o horário para novos agendamentos
          if (row?.hour && (row.status === 'confirmado' || row.status === 'pendente' || row.status === 'bloqueado')) {
            booked.push(row.hour);
          }
        });

        // Buscar horários bloqueados
        try {
          const bloqueadosSnapshot = await getDocs(bloqueadosQuery);
          bloqueadosSnapshot.forEach((d) => {
            const row = d.data();
            if (row?.hour) booked.push(row.hour);
          });
        } catch (error) {
          console.error('Erro ao buscar horários bloqueados:', error);
        }

        if (state.selectedSlot && booked.includes(state.selectedSlot)) {
          state.selectedSlot = "";
        }
        renderSlots(booked);
      } catch (error) {
        console.error('Erro ao processar snapshot:', error);
        setInfo("info-error", "Erro de sincronização", "Erro ao atualizar horários. Tente recarregar a página.");
      }
    },
    (error) => {
      console.error('Erro no listener em tempo real:', error);
      setInfo("info-error", "Erro de conexão", "Não foi possível atualizar os horários em tempo real. Verifique sua conexão.");
      // TENTATIVA DE RECONEXÃO AUTOMÁTICA após 5 segundos
      if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
      state.reconnectTimer = setTimeout(() => {
        if (state.firebaseReady && state.selectedDate) {
          console.log('Tentando reconexão automática...');
          subscribeDay(state.selectedDate);
        }
      }, 5000);
    }
  );
  
  state.activeUnsubscribe = agendamentosUnsubscribe;
}

function localKey(dateISO) {
  return `agendamentos_${dateISO}`;
}

function getLocalBookedHours(dateISO) {
  try {
    const raw = localStorage.getItem(localKey(dateISO));
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Object.keys(data || {});
  } catch {
    return [];
  }
}

function localSaveBooking(booking) {
  const key = localKey(booking.dateISO);
  const current = JSON.parse(localStorage.getItem(key) || "{}");
  if (current[booking.hour]) throw new Error("SLOT_ALREADY_BOOKED");
  current[booking.hour] = booking;
  localStorage.setItem(key, JSON.stringify(current));
}

function buildStudioMessage(booking) {
  return (
    "🔔 NOVO AGENDAMENTO PENDENTE 🔔\n\n" +
    "Cliente: " + booking.nome + "\n" +
    "💅 Serviço: " + booking.servico + "\n" +
    "Celular: " + booking.celular + "\n" +
    "Data: " + formatDateBR(booking.dateISO) + "\n" +
    "Horário: " + booking.hour + "\n" +
    "Status: pendente\n" +
    "Painel administrativo: Confirme agendamento em seu painel !!!\n\n" +
    "📅 Confirme no sistema e entre em contato se necessário."
  );
}

function buildClientMessage(booking) {
  return (
    "✨Seu horário está confirmado!✨\n\n" +
    "Agradeço imensamente pela confiança em meu trabalho...\n\n" +
    "� Serviço: " + booking.servico + "\n" +
    "📅 Data: " + formatDateBR(booking.dateISO) + "\n" +
    "⏰ Horário: " + booking.hour + "\n" +
    "📍 Endereço: Rua Olinto Magalhães, 1628, BH\n\n" +
    "📞 Dúvidas? (31) 99362-7475"
  );
}

function buildReminderMessage(booking) {
  return (
    "⏰ *LEMBRETE DE AGENDAMENTO* ⏰\n\n" +
    "Olá, " + booking.nome + "!\n\n" +
    "Seu atendimento no Studio Stephanie Sena é daqui a 2 horas:\n" +
    "📅 *Data:* " + formatDateBR(booking.dateISO) + "\n" +
    "⏰ *Horário:* " + booking.hour + "\n\n" +
    "Por favor, confirme sua presença:\n" +
    "[1] ✅ Confirmar presença\n" +
    "[2] ❌ Cancelar agendamento\n\n" +
    "Responda com 1 ou 2 para continuarmos! 📞"
  );
}

async function notifyWebhook(booking) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "agendamento_confirmado",
        booking
      })
    });
  } catch (error) {
    // opcional, nao impede fluxo
  }
}

function sendWhatsAppNotification(phone, message) {
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener");
}

async function sendNotifications(booking) {
  // Envia mensagem para a dona do studio
  const studioMessage = buildStudioMessage(booking);
  sendWhatsAppNotification(STUDIO_WHATSAPP, studioMessage);
  
  // Envia mensagem de confirmação para o cliente
  const clientMessage = buildClientMessage(booking);
  sendWhatsAppNotification(booking.celular, clientMessage);
}

async function bookSlot(formData) {
  // Força uso do Firebase - sem fallback para localStorage
  if (!state.firebaseReady || !state.db) {
    throw new Error("Firebase não está pronto. Por favor, recarregue a página.");
  }

  const { nome, celular, dateISO, hour, servico } = formData;
  
  // VALIDAÇÃO DE SEGURANÇA - Garante que as regras sejam respeitadas
  // Sempre interpretar no fuso local para evitar inconsistências
  const date = new Date(dateISO + 'T00:00:00');
  const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda-feira, 6 = Sábado
  
  // DOMINGOS: Bloquear completamente
  if (dayOfWeek === 0) {
    throw new Error("Domingos não estão disponíveis para agendamento. Por favor, escolha outro dia.");
  }
  
  // SEGUNDAS-FEIRAS: Bloquear completamente (folga da profissional)
  if (dayOfWeek === 1) {
    throw new Error("Segundas-feiras não estão disponíveis para agendamento (folga da profissional). Por favor, escolha outro dia.");
  }
  
  try {
    // Salvar no Firebase
    const docRef = await addDoc(collection(state.db, "agendamentos"), {
      nome,
      celular,
      servico,
      dateISO,
      hour,
      status: AGENDAMENTO_STATUS.PENDENTE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const booking = {
      id: docRef.id,
      nome,
      celular,
      servico,
      dateISO,
      hour,
      status: AGENDAMENTO_STATUS.PENDENTE
    };

    return booking;
  } catch (error) {
    console.error('Erro ao salvar agendamento:', error);
    throw error;
  }
}

async function updateBookingStatus(bookingId, newStatus) {
  // Força uso do Firebase - sem fallback para localStorage
  if (!state.firebaseReady || !state.db) {
    throw new Error("Firebase não está pronto para atualizar status.");
  }

  const ref = doc(state.db, "agendamentos", bookingId);
  await updateDoc(ref, {
    status: newStatus,
    updatedAt: serverTimestamp()
  });
}

async function processWhatsAppResponse(phone, message, bookingId) {
  try {
    // Procura o agendamento pelo ID
    const bookingDoc = await doc(collection(state.db, "agendamentos", bookingId));
    const bookingSnap = await getDoc(bookingDoc);
    
    if (!bookingSnap.exists()) {
      console.log('Agendamento não encontrado:', bookingId);
      return;
    }
    
    const booking = bookingSnap.data();
    
    // Processa a resposta
    if (message.trim().toLowerCase().includes('cancelar') || message.trim() === '2') {
      // Cancelar agendamento
      await updateBookingStatus(bookingId, AGENDAMENTO_STATUS.CANCELADO);
      
      // Envia confirmação de cancelamento
      const cancelMessage = `❌ *AGENDAMENTO CANCELADO* ❌\n\n` +
        `Olá, ${booking.nome}!\n\n` +
        `Seu agendamento foi cancelado conforme solicitado.\n\n` +
        `Se desejar remarcar, acesse nosso site novamente.\n` +
        `Obrigada pelo aviso! 📞`;
      
      sendWhatsAppNotification(phone, cancelMessage);
      
      // Notifica a dona do studio
      const studioNotification = `🔔 *CANCELAMENTO RECEBIDO*\n\n` +
        `Cliente: ${booking.nome}\n` +
        `Celular: ${booking.celular}\n` +
        `Data: ${formatDateBR(booking.dateISO)}\n` +
        `Horário: ${booking.hour}\n\n` +
        `Horário liberado para novos agendamentos.`;
      
      sendWhatsAppNotification(STUDIO_WHATSAPP, studioNotification);
      
      console.log('Agendamento cancelado:', bookingId);
    }
  } catch (error) {
    console.error('Erro ao processar resposta:', error);
  }
}

async function cancelBooking(bookingId) {
  await updateBookingStatus(bookingId, AGENDAMENTO_STATUS.CANCELADO);
}

function handleSlotsClick(event) {
  const btn = event.target.closest("button.slot-btn");
  if (!btn || btn.disabled) return;
  state.selectedSlot = btn.dataset.hour;

  document.querySelectorAll(".slot-btn").forEach((item) => item.classList.remove("is-selected"));
  btn.classList.add("is-selected");
}

async function ensureNoPastDate(dateISO) {
  if (!dateISO) throw new Error("DATA_OBRIGATORIA");
  if (dateISO <= todayStr()) throw new Error("DATA_INVALIDA");
  const selected = new Date(dateISO + 'T00:00:00');
  const day = selected.getDay();
  if (day === 0 || day === 1) throw new Error("DIA_NAO_DISPONIVEL");
}

function enableWhatsButton(booking) {
  state.selectedBooking = booking;
  if (!el.btnConfirmarWhats) return;
  el.btnConfirmarWhats.classList.remove("hidden");
  el.btnCancelarAgendamento.classList.remove("hidden");
}

function disableButtons() {
  if (el.btnConfirmarWhats) el.btnConfirmarWhats.classList.add("hidden");
  if (el.btnCancelarAgendamento) el.btnCancelarAgendamento.classList.add("hidden");
}

async function cancelCurrentBooking() {
  if (!state.selectedBooking) return;
  
  try {
    await cancelBooking(state.selectedBooking.id);
    
    setInfo(
      "info-warn",
      "Agendamento cancelado",
      `Horário ${state.selectedBooking.hour} liberado para novos agendamentos.`
    );
    
    // Limpa o estado
    state.selectedBooking = null;
    disableButtons();
    
    // Atualiza os horários disponíveis
    if (state.selectedDate) {
      await refreshInitialSlots(state.selectedDate);
    }
    
  } catch (error) {
    setInfo(
      "info-error",
      "Erro ao cancelar",
      "Não foi possível cancelar o agendamento. Tente novamente."
    );
  }
}

function confirmByWhatsapp() {
  if (!state.selectedBooking) return;
  
  // Rastreia clique no botão de agendamento
  trackAgendamentoClick();
  
  const message = buildClientMessage(state.selectedBooking);
  window.open(`https://api.whatsapp.com/send?phone=${STUDIO_WHATSAPP}&text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

// Funções do Modal de Pagamento
function showPaymentModal(formData) {
  if (!el.paymentModal) return;
  
  const { nome, servico, dateISO, hour } = formData;
  const valores = calcularValoresServico(servico);
  
  // Preencher dados do resumo
  if (el.paymentServico) el.paymentServico.textContent = servico;
  if (el.paymentData) el.paymentData.textContent = formatDateBR(dateISO);
  if (el.paymentHora) el.paymentHora.textContent = hour;
  if (el.paymentValorTotal) el.paymentValorTotal.textContent = `R$ ${valores.valorTotal.toFixed(2).replace('.', ',')}`;
  if (el.paymentValorSinal) el.paymentValorSinal.textContent = `R$ ${valores.valorSinal.toFixed(2).replace('.', ',')}`;
  if (el.paymentValorRestante) el.paymentValorRestante.textContent = `R$ ${valores.valorRestante.toFixed(2).replace('.', ',')}`;
  // Limpar status anterior
  if (el.paymentStatus) el.paymentStatus.textContent = '';
  
  // Resetar para aba PIX
  switchPaymentMethod('pix');
  
  // Mostrar modal - usar classe active e remover atributo hidden
  el.paymentModal.classList.remove('hidden');
  el.paymentModal.classList.add('active');
  el.paymentModal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  
  // Armazenar dados para uso posterior
  state.currentPaymentData = {
    ...formData,
    ...valores
  };
}

function hidePaymentModal() {
  if (!el.paymentModal) return;
  
  // Esconder modal - adicionar hidden e remover active
  el.paymentModal.classList.add('hidden');
  el.paymentModal.classList.remove('active');
  el.paymentModal.setAttribute('hidden', '');
  document.body.style.overflow = '';
  state.currentPaymentData = null;
}

function switchPaymentMethod(method) {
  if (method !== 'pix') return;
  if (el.pixTab) el.pixTab.classList.add('active');
  if (el.pixPayment) el.pixPayment.classList.add('active');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

async function copyPixCode() {
  if (!el.pixCode) return;
  
  try {
    await navigator.clipboard.writeText(el.pixCode.value);
    
    const originalText = el.copyPixCode.textContent;
    el.copyPixCode.textContent = '✅ Copiado!';
    el.copyPixCode.style.background = '#28a745';
    
    // Mostrar instruções para envio do comprovante
    if (el.paymentStatus) {
      el.paymentStatus.innerHTML = '<span style="color: #28a745;">✅ Chave PIX copiada! Faça o pagamento no seu banco e depois clique em "Já realizei o pagamento, confirmar agendamento".</span>';
    }
    
    // Mostrar instruções de WhatsApp se existirem
    const whatsappInstructions = document.getElementById('whatsappInstructions');
    if (whatsappInstructions) {
      whatsappInstructions.style.display = 'block';
      whatsappInstructions.style.color = '#28a745';
      whatsappInstructions.style.fontWeight = 'bold';
    }
    
    setTimeout(() => {
      el.copyPixCode.textContent = originalText;
      el.copyPixCode.style.background = '';
    }, 2000);
    
  } catch (error) {
    console.error('Erro ao copiar código:', error);
    if (el.paymentStatus) {
      el.paymentStatus.innerHTML = '<span style="color: #dc3545;">❌ Erro ao copiar código. Copie manualmente: 153.419.406-10 e depois confirme o pagamento.</span>';
    }
  }
}

async function bookSlotWithPayment(formData) {
  if (!state.firebaseReady || !state.db) {
    throw new Error("Firebase não está pronto. Por favor, recarregue a página.");
  }

  const { nome, celular, servico, dateISO, hour, valorTotal, valorSinal, valorRestante, pagamentoId, metodoPagamento, statusFinanceiro } = formData;
  const id = slotId(dateISO, hour);
  const ref = doc(state.db, "agendamentos", slotId(dateISO, hour));
  
  await runTransaction(state.db, async (transaction) => {
    const docSnap = await transaction.get(ref);
    if (docSnap.exists()) throw new Error("SLOT_ALREADY_BOOKED");
    transaction.set(ref, {
      nome,
      celular,
      servico,
      dateISO,
      hour,
      status: AGENDAMENTO_STATUS.CONFIRMADO, // Confirmado automaticamente após pagamento
      statusFinanceiro,
      valorTotal,
      valorSinal,
      valorRestante,
      pagamentoId,
      metodoPagamento,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  return {
    id,
    dateISO,
    hour,
    nome,
    celular,
    servico,
    status: AGENDAMENTO_STATUS.CONFIRMADO,
    statusFinanceiro,
    valorTotal,
    valorSinal,
    valorRestante,
    pagamentoId,
    metodoPagamento
  };
}

async function refreshInitialSlots(dateISO) {
  // Força uso do Firebase - sem fallback para localStorage
  if (!state.firebaseReady || !state.db) {
    console.error('Firebase não está pronto para atualizar horários');
    renderSlots([]);
    return;
  }
  const q = query(collection(state.db, "agendamentos"), where("dateISO", "==", dateISO));
  const snapshot = await getDocs(q);
  const booked = [];
  snapshot.forEach((d) => {
    const row = d.data();
    // CORREÇÃO CRÍTICA: Horários cancelados DEVEM ser liberados imediatamente
    // Apenas status 'confirmado', 'pendente' e 'bloqueado' ocupam o horário
    // Status 'cancelado' libera o horário para novos agendamentos
    if (row?.hour && (row.status === 'confirmado' || row.status === 'pendente' || row.status === 'bloqueado')) {
      booked.push(row.hour);
    }
  });
  renderSlots(booked);
}

function initSchedulerEvents() {
  if (!el.dataAgendamento || !el.leadForm || !el.slotsGrid) return;

  el.dataAgendamento.min = tomorrowStr();
  el.dataAgendamento.value = tomorrowStr();
  state.selectedDate = el.dataAgendamento.value;
  renderSlots([]);

  el.dataAgendamento.addEventListener("change", async () => {
    const selectedDate = el.dataAgendamento.value;
    
    // VALIDAÇÃO DE DOMINGOS: Bloquear seleção de domingos
    if (selectedDate) {
      const date = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = date.getDay(); // 0 = Domingo
      
      if (dayOfWeek === 0 || dayOfWeek === 1) {
        setInfo("info-error", "Dia indisponível", "Domingos e segundas-feiras não estão disponíveis para agendamento.");
        el.dataAgendamento.value = state.selectedDate || tomorrowStr();
        return;
      }

      if (selectedDate <= todayStr()) {
        setInfo("info-error", "Data indisponível", "Agendamentos são permitidos apenas a partir de amanhã (D+1).");
        el.dataAgendamento.value = state.selectedDate || tomorrowStr();
        return;
      }
    }
    
    state.selectedDate = selectedDate;
    state.selectedSlot = "";
    if (state.firebaseReady) {
      await refreshInitialSlots(state.selectedDate);
      await subscribeDay(state.selectedDate);
    }
  });

  el.slotsGrid.addEventListener("click", handleSlotsClick);

  el.leadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Firebase sempre deve estar pronto - sem verificação de pendência

    const nome = (el.nome.value || "").trim();
    const celularRaw = (el.celular.value || "").trim();
    const celular = normalizePhone(celularRaw);
    const servico = (el.servico.value || "").trim();
    const dateISO = el.dataAgendamento.value;
    const hour = state.selectedSlot;

    try {
      if (!nome || nome.length < 4) throw new Error("NOME_INVALIDO");
      if (!celular || celular.length < 10) throw new Error("CELULAR_INVALIDO");
      await ensureNoPastDate(dateISO);
      if (!servico) throw new Error("SERVICO_OBRIGATORIO");
      if (!hour) throw new Error("HORA_OBRIGATORIA");

      el.btnConfirmarSlot.disabled = true;
      el.btnConfirmarSlot.innerHTML = '<span class="loading-spinner"></span> Agendando...';
      
      try {
        // Mostrar modal de pagamento em vez de confirmar diretamente
        showPaymentModal({ nome, celular, servico, dateISO, hour });
        
        el.btnConfirmarSlot.innerHTML = 'Confirmar agendamento';
        
      } catch (error) {
        throw error; // Propaga erro para o catch externo
      }
    } catch (error) {
      if (error.message === "SLOT_ALREADY_BOOKED") {
        setInfo("info-warn", "Horário indisponível", "Esse horário já foi reservado por outro cliente. Escolha outro horário.");
      } else if (error.message === "NOME_INVALIDO") {
        setInfo("info-error", "Nome inválido", "Digite seu nome completo para continuar.");
      } else if (error.message === "CELULAR_INVALIDO") {
        setInfo("info-error", "Celular inválido", "Digite um número de celular válido com DDD.");
      } else if (error.message === "DATA_INVALIDA") {
        setInfo("info-error", "Data inválida", "Selecione uma data a partir de amanhã (D+1).");
      } else if (error.message === "DIA_NAO_DISPONIVEL") {
        setInfo("info-error", "Dia indisponível", "Domingos e segundas-feiras são dias de folga.");
      } else if (error.message === "SERVICO_OBRIGATORIO") {
        setInfo("info-error", "Serviço obrigatório", "Selecione o serviço desejado para continuar.");
      } else if (error.message === "HORA_OBRIGATORIA") {
        setInfo("info-error", "Horário obrigatório", "Selecione um horário disponível.");
      } else {
        setInfo("info-error", "Falha ao confirmar", "Não foi possível concluir agora. Tente novamente em alguns segundos.");
      }
    } finally {
      el.btnConfirmarSlot.disabled = false;
      el.btnConfirmarSlot.innerHTML = 'Confirmar agendamento';
    }
  });

  if (el.btnConfirmarWhats) {
    el.btnConfirmarWhats.addEventListener("click", confirmByWhatsapp);
  }
  
  if (el.btnCancelarAgendamento) {
    el.btnCancelarAgendamento.addEventListener("click", cancelCurrentBooking);
  }

  // Event listeners do modal de pagamento
  if (el.closePaymentModal) {
    el.closePaymentModal.addEventListener("click", hidePaymentModal);
  }
  
  if (el.cancelPayment) {
    el.cancelPayment.addEventListener("click", hidePaymentModal);
  }
  
  if (el.pixTab) {
    el.pixTab.addEventListener("click", () => switchPaymentMethod('pix'));
  }
  
  if (el.copyPixCode) {
    el.copyPixCode.addEventListener("click", copyPixCode);
  }
  
  if (el.confirmPayment) {
    el.confirmPayment.addEventListener("click", confirmarPagamentoComSinal);
  }
  
    
  // Fechar modal ao clicar fora
  if (el.paymentModal) {
    el.paymentModal.addEventListener("click", (e) => {
      if (e.target === el.paymentModal) {
        hidePaymentModal();
      }
    });
  }
}

function initMentoria() {
  if (!el.mentoriaForm) return;
  el.mentoriaForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = (el.mentoriaNome.value || "").trim();
    const msg =
      `Olá Stephanie! Meu nome é ${nome || "—"}. Tenho interesse na mentoria e gostaria de marcar uma visita para conhecer valores e datas.`;
    window.open(`https://api.whatsapp.com/send?phone=${STUDIO_WHATSAPP}&text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  });
}

// Garantir que o modal comece oculto
function ensureModalHidden() {
  if (el.paymentModal) {
    // Forçar estado oculto com múltiplas camadas de proteção
    el.paymentModal.classList.add('hidden');
    el.paymentModal.classList.remove('active');
    el.paymentModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }
}

async function confirmarPagamentoComSinal() {
  if (!state.currentPaymentData) return;
  
  try {
    const { nome, celular, servico, dateISO, hour, valorTotal, valorSinal, valorRestante } = state.currentPaymentData;
    
    // Determinar método de pagamento baseado na aba ativa
    const metodoPagamento = 'pix';
    
    // Salvar agendamento com status pago (trigger automático)
    const booking = await bookSlotWithPayment({ 
      nome, 
      celular, 
      servico, 
      dateISO, 
      hour, 
      valorTotal, 
      valorSinal, 
      valorRestante,
      pagamentoId: 'manual_' + Date.now(),
      metodoPagamento,
      statusFinanceiro: STATUS_FINANCEIRO.PAGO, // Status pago automaticamente
      status: AGENDAMENTO_STATUS.CONFIRMADO // Status confirmado automaticamente
    });
    
    // Fechar modal
    hidePaymentModal();
    
    // Rastrear evento
    trackEvent('pagamento_confirmado', {
      event_category: 'conversion',
      event_label: 'sinal_agendamento',
      value: valorSinal
    });
    
    // Mostrar sucesso
    setInfo(
      "info-ok",
      "Pagamento confirmado!",
      `Pagamento de R$ ${valorSinal.toFixed(2).replace('.', ',')} confirmado com sucesso! Agendamento confirmado para ${formatDateBR(dateISO)} às ${hour}.`
    );
    
    // Limpar formulário
    el.nome.value = "";
    el.celular.value = "";
    el.servico.value = "";
    state.selectedSlot = "";
    
    // Enviar notificação apenas para a dona do site
    await sendNotificationsComPagamento(booking, valorSinal, metodoPagamento);
    
    // Habilitar botão WhatsApp para cliente (será usado no painel admin)
    enableWhatsButton(booking);
    
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    if (el.paymentStatus) {
      el.paymentStatus.innerHTML = '<span style="color: #dc3545;">❌ Erro ao confirmar pagamento</span>';
    }
  }
}

async function sendNotificationsComPagamento(booking, valorSinal, metodoPagamento) {
  try {
    // Verificar se já foi notificado
    if (booking.notificado === true) {
      console.log('✅ Agendamento já notificado anteriormente');
      return;
    }
    
    // Notificação para Stephanie com informação do pagamento
    const stephanieMessage = buildStephanieMessageWithPayment(booking, valorSinal, metodoPagamento);
    
    // Redirecionar cliente direto para WhatsApp da Stephanie
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${STUDIO_WHATSAPP}&text=${encodeURIComponent(stephanieMessage)}`;
    
    // Tentar abrir em nova aba, com fallback para redirecionamento direto
    try {
      window.open(whatsappUrl, "_blank", "noopener");
      
      // Marcar como notificado com sucesso
      await marcarComoNotificado(booking.id);
      console.log('✅ Notificação enviada e marcada como entregue');
      
    } catch (popupError) {
      console.log('window.open bloqueado, usando fallback para redirecionamento direto');
      // Fallback para bloqueadores de popup
      window.location.href = whatsappUrl;
      
      // Marcar como notificado mesmo com fallback
      setTimeout(async () => {
        await marcarComoNotificado(booking.id);
        console.log('✅ Notificação enviada via fallback e marcada como entregue');
      }, 2000);
    }
    
  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error);
    
    // Tentar reenvio automático após 5 segundos
    setTimeout(async () => {
      try {
        console.log('🔄 Tentando reenvio automático...');
        const fallbackUrl = `https://api.whatsapp.com/send?phone=${STUDIO_WHATSAPP}&text=${encodeURIComponent('Olá! Realizei o pagamento do meu agendamento.')}`;
        window.location.href = fallbackUrl;
        
        await marcarComoNotificado(booking.id);
        console.log('✅ Reenvio automático realizado');
      } catch (retryError) {
        console.error('❌ Erro no reenvio automático:', retryError);
        alert('Erro ao enviar notificação. Por favor, contate a Stephanie diretamente.');
      }
    }, 5000);
  }
}

// Marcar agendamento como notificado
async function marcarComoNotificado(bookingId) {
  try {
    if (!bookingId || !state.db) return;
    
    const bookingRef = doc(state.db, "agendamentos", bookingId);
    await updateDoc(bookingRef, {
      notificado: true,
      dataNotificacao: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`📝 Agendamento ${bookingId} marcado como notificado`);
  } catch (error) {
    console.error('Erro ao marcar como notificado:', error);
  }
}

// Verificar notificações pendentes (para recuperação)
window.verificarNotificacoesPendentes = async function() {
  try {
    console.log('🔍 Verificando notificações pendentes...');
    
    const q = query(
      collection(state.db, "agendamentos"),
      where("notificado", "!=", true),
      where("statusFinanceiro", "==", "pago"),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    const pendentes = [];
    
    snapshot.forEach((doc) => {
      const booking = doc.data();
      pendentes.push({
        id: doc.id,
        ...booking
      });
    });
    
    if (pendentes.length > 0) {
      console.log(`📋 Encontrados ${pendentes.length} agendamentos com notificação pendente`);
      
      // Tentar reenviar notificações pendentes
      for (const pendente of pendentes) {
        try {
          await sendNotificationsComPagamento(pendente, pendente.valorSinal || 0, pendente.metodoPagamento || 'pix');
          console.log(`🔄 Reenviando notificação para: ${pendente.nome}`);
        } catch (error) {
          console.error(`❌ Erro ao reenviar para ${pendente.nome}:`, error);
        }
      }
    } else {
      console.log('✅ Nenhuma notificação pendente encontrada');
    }
    
  } catch (error) {
    console.error('Erro ao verificar notificações pendentes:', error);
  }
};

function buildStephanieMessageWithPayment(booking, valorSinal, metodoPagamento) {
  const metodo = metodoPagamento === 'pix' ? 'PIX' : 'Nubank';
  return `Olá! Um novo agendamento foi solicitado por ${booking.nome}.
  
📱 Celular: ${booking.celular}
💅 Serviço: ${booking.servico}
📅 Data: ${formatDateBR(booking.dateISO)}
⏰ Horário: ${booking.hour}
💰 Valor do Sinal: R$ ${valorSinal.toFixed(2).replace('.', ',')}
💳 Método: ${metodo}

Acesse o painel para confirmar o sinal e enviar a confirmação oficial.`;
}

function buildClientMessageWithPayment(booking, valorSinal, metodoPagamento) {
  // Essa função não é mais utilizada
  return `Olá ${booking.nome}! ✅

Seu agendamento foi registrado com sucesso!

📅 Data: ${formatDateBR(booking.dateISO)}
⏰ Horário: ${booking.hour}
💅 Serviço: ${booking.servico}
💰 Sinal pago: R$ ${valorSinal.toFixed(2).replace('.', ',')}
💳 Método: ${metodo}

Aguarde a confirmação do pagamento para finalizar seu agendamento. Em breve entraremos em contato!

Studio Stephanie Sena 🌟`;
}

async function finalizarProcessoCompleto(paymentResult) {
  if (!state.currentPaymentData) return;
  
  try {
    const { nome, celular, servico, dateISO, hour, valorTotal, valorSinal, valorRestante } = state.currentPaymentData;
    
    // Salvar agendamento com status financeiro
    const booking = await bookSlotWithPayment({ 
      nome, 
      celular, 
      servico, 
      dateISO, 
      hour, 
      valorTotal, 
      valorSinal, 
      valorRestante,
      pagamentoId: paymentResult.paymentId,
      metodoPagamento: paymentResult.method,
      statusFinanceiro: STATUS_FINANCEIRO.PAGO
    });
    
    // Fechar modal
    hidePaymentModal();
    
    // Rastrear evento de pagamento
    trackEvent('pagamento_concluido', {
      event_category: 'conversion',
      event_label: 'sinal_agendamento',
      value: valorSinal
    });
    
    // Mostrar sucesso
    setInfo(
      "info-ok",
      "Pagamento confirmado!",
      `Sinal de R$ ${valorSinal.toFixed(2).replace('.', ',')} pago com sucesso. Agendamento confirmado para ${formatDateBR(dateISO)} às ${hour}.`
    );
    
    // Limpar formulário
    el.nome.value = "";
    el.celular.value = "";
    el.servico.value = "";
    state.selectedSlot = "";
    
    // Enviar notificações APÓS o pagamento
    await sendNotifications(booking);
    
    // Habilitar botão WhatsApp
    enableWhatsButton(booking);
    
  } catch (error) {
    console.error('Erro ao finalizar agendamento:', error);
    if (el.paymentStatus) {
      el.paymentStatus.innerHTML = '<span style="color: #dc3545;">❌ Erro ao confirmar agendamento</span>';
    }
  }
}

async function boot() {
  // PRIMEIRO: Garantir que o modal esteja absolutamente oculto
  ensureModalHidden();
  
  window.addEventListener("scroll", reveal);
  reveal();

  initMentoria();
  initSchedulerEvents();
  await initFirebase();

  state.selectedDate = el.dataAgendamento.value || tomorrowStr();
  await refreshInitialSlots(state.selectedDate);
  await subscribeDay(state.selectedDate);
  if (state.mode === "firebase") {
    setInfo("info-ok", "Sistema online", "Agendamento em tempo real ativo. Escolha data e horário para reservar.");
  } else {
    setInfo("info-warn", "Modo local ativo", "Agendamento funcionando no site. Para sincronizar entre todos os clientes, conecte o Firebase.");
  }
}

// Lightbox para Catálogo de Serviços
document.addEventListener('DOMContentLoaded', function() {
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImage = document.getElementById('lightboxImage');
  const closeLightbox = document.getElementById('closeLightbox');
  const catalogoImages = document.querySelectorAll('.catalogo-img-lightbox');

  // Abrir lightbox ao clicar em imagem do catálogo
  catalogoImages.forEach(img => {
    img.addEventListener('click', function() {
      lightboxImage.src = this.src;
      lightboxModal.classList.remove('hidden');
      lightboxModal.removeAttribute('hidden');
      document.body.classList.add('no-scroll');
    });
  });

  // Fechar lightbox
  closeLightbox.addEventListener('click', function() {
    lightboxModal.classList.add('hidden');
    lightboxModal.setAttribute('hidden', '');
    document.body.classList.remove('no-scroll');
  });

  // Fechar lightbox ao clicar fora da imagem
  lightboxModal.addEventListener('click', function(e) {
    if (e.target === lightboxModal) {
      lightboxModal.classList.add('hidden');
      lightboxModal.setAttribute('hidden', '');
      document.body.classList.remove('no-scroll');
    }
  });

  // Fechar lightbox com ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !lightboxModal.classList.contains('hidden')) {
      lightboxModal.classList.add('hidden');
      lightboxModal.setAttribute('hidden', '');
      document.body.classList.remove('no-scroll');
    }
  });
});

boot();

window.addEventListener('beforeunload', () => {
  clearRealtimeSubscription();
});
