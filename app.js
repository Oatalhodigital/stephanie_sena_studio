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

const state = {
  db: null,
  firebaseReady: false,
  mode: "local",
  selectedDate: todayStr(),
  selectedSlot: "",
  activeUnsubscribe: null,
  selectedBooking: null,
  payment: {
    method: null,
    service: null,
    amount: null,
    reservationAmount: null,
    remainingAmount: null
  }
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
  mentoriaNome: document.getElementById("mentoriaNome")
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

function formatDateBR(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function slotId(dateISO, hour) {
  return `${dateISO}_${hour}`;
}

function createHourSlots(selectedDate) {
  const list = [];
  const date = new Date(selectedDate);
  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Define horários limite: 17:00 dias úteis, 20:00 fins de semana
  const lastHour = isWeekend ? 20 : 17;
  
  // Gera horários de 1h30 em 1h30
  for (let h = HOUR_START; h <= lastHour; h += 1.5) {
    const hour = Math.floor(h);
    const minutes = (h - hour) * 60;
    list.push(`${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
  }
  
  return list;
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
  const firebaseConfig = await getFirebaseConfig();
  if (!firebaseConfig) {
    state.mode = "local";
    state.firebaseReady = false;
    renderSlots([]);
    disableScheduler(false);
    return;
  }

  const app = initializeApp(firebaseConfig);
  state.db = getFirestore(app);
  state.firebaseReady = true;
  state.mode = "firebase";
  disableScheduler(false);
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
}

async function subscribeDay(dateISO) {
  if (!dateISO) return;

  if (!state.firebaseReady || !state.db) {
    renderSlots(getLocalBookedHours(dateISO));
    return;
  }

  clearRealtimeSubscription();
  const q = query(collection(state.db, "agendamentos"), where("dateISO", "==", dateISO));
  state.activeUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const booked = [];
      snapshot.forEach((d) => {
        const row = d.data();
        if (row?.hour) booked.push(row.hour);
      });

      if (state.selectedSlot && booked.includes(state.selectedSlot)) {
        state.selectedSlot = "";
      }
      renderSlots(booked);
    },
    () => {
      setInfo("info-error", "Erro de conexão", "Não foi possível atualizar os horários em tempo real.");
    }
  );
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
    "🔔 *NOVO AGENDAMENTO CONFIRMADO* 🔔\n\n" +
    "Cliente: " + booking.nome + "\n" +
    "💅 *Serviço:* " + booking.servico + "\n" +
    "*Celular:* " + booking.celular + "\n" +
    "*Data:* " + formatDateBR(booking.dateISO) + "\n" +
    "*Horário:* " + booking.hour + "\n" +
    "*Status:* " + booking.status + "\n\n" +
    "📅 Confirme no sistema e entre em contato se necessário."
  );
}

function buildClientMessage(booking) {
  return (
    "✨Seu horário está confirmado!✨\n\n" +
    "Agradeço imensamente pela confiança em meu trabalho.\n" +
    "Gentilmente, peço sua compreensão quanto à tolerância de até 10 minutos para o início do atendimento. Caso haja atraso superior a esse período, infelizmente não será possível realizar a decoração desejada.\n" +
    "É obrigatório que me envie com antecedência a decoração ou estilo escolhido. Caso não seja enviado, o procedimento será realizado sem decoração.\n" +
    "Será um prazer recebê-la 💖.\n\n" +
    "� *Serviço:* " + booking.servico + "\n\n" +
    "� *Data:* " + formatDateBR(booking.dateISO) + "\n" +
    "⏰ *Horário:* " + booking.hour + "\n" +
    "📍 *Endereço:* Rua Olinto Magalhães, 1628, BH\n\n" +
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
  if (!state.firebaseReady || !state.db) {
    const localBooking = {
      id: slotId(formData.dateISO, formData.hour),
      ...formData,
      status: AGENDAMENTO_STATUS.PENDENTE,
      createdAt: new Date().toISOString()
    };
    localSaveBooking(localBooking);
    return localBooking;
  }

  const { nome, celular, dateISO, hour, servico } = formData;
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
        status: AGENDAMENTO_STATUS.PENDENTE,
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
    status: AGENDAMENTO_STATUS.PENDENTE
  };
}

async function updateBookingStatus(bookingId, newStatus) {
  if (!state.firebaseReady || !state.db) {
    // Update local storage
    const dateISO = bookingId.split('_')[0];
    const key = localKey(dateISO);
    const current = JSON.parse(localStorage.getItem(key) || "{}");
    if (current[bookingId]) {
      current[bookingId].status = newStatus;
      current[bookingId].updatedAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(current));
    }
    return;
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
  if (dateISO < todayStr()) throw new Error("DATA_INVALIDA");
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

// Funções de Pagamento
function openPaymentModal(serviceName) {
  if (!window.PAYMENT_CONFIG) {
    console.error('Configuração de pagamento não encontrada');
    return;
  }
  
  const payment = PAYMENT_CONFIG.calculateSignal(serviceName);
  
  // Atualizar estado de pagamento
  state.payment = {
    method: null,
    service: serviceName,
    signalAmount: payment.signalAmount,
    remainingAmount: payment.remainingAmount
  };
  
  // Preencher informações no modal
  document.getElementById('paymentService').textContent = serviceName;
  document.getElementById('paymentTotal').textContent = PAYMENT_CONFIG.formatBRL(payment.servicePrice);
  document.getElementById('paymentSignal').textContent = PAYMENT_CONFIG.formatBRL(payment.signalAmount);
  document.getElementById('paymentRemaining').textContent = PAYMENT_CONFIG.formatBRL(payment.remainingAmount);
  
  // Usar QR Code personalizado
  const qrCodePath = PAYMENT_CONFIG.getQRCodePath(payment.signalAmount);
  document.getElementById('pixQRCode').src = qrCodePath;
  
  // Mostrar modal
  document.getElementById('paymentModal').classList.add('active');
  
  // Resetar seleção de método
  document.querySelectorAll('.payment-option').forEach(btn => btn.classList.remove('selected'));
  document.querySelectorAll('.payment-form').forEach(form => form.classList.add('hidden'));
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
  state.payment.method = null;
}

function selectPaymentMethod(method) {
  // Atualizar seleção visual
  document.querySelectorAll('.payment-option').forEach(btn => btn.classList.remove('selected'));
  event.target.closest('.payment-option').classList.add('selected');
  
  // Esconder todos os formulários
  document.querySelectorAll('.payment-form').forEach(form => form.classList.add('hidden'));
  
  // Mostrar formulário selecionado
  document.getElementById(method + 'Payment').classList.remove('hidden');
  
  // Atualizar estado
  state.payment.method = method;
}

function copyPixKey() {
  const pixKey = document.getElementById('pixKey').textContent;
  navigator.clipboard.writeText(pixKey).then(() => {
    // Feedback visual
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ Copiado!';
    btn.style.background = '#059669';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 2000);
  }).catch(err => {
    console.error('Erro ao copiar chave Pix:', err);
    alert('Não foi possível copiar a chave. Copie manualmente.');
  });
}

async function confirmPayment() {
  if (!state.payment.method) {
    alert('Selecione uma forma de pagamento');
    return;
  }
  
  try {
    // Criar agendamento com status "pendente" (sem aguardando pagamento)
    const booking = await bookSlot({
      nome: el.nome.value,
      celular: el.celular.value,
      servico: state.payment.service,
      dateISO: state.selectedDate,
      hour: state.selectedSlot,
      status: 'pendente',
      paymentMethod: state.payment.method,
      signalAmount: state.payment.signalAmount,
      remainingAmount: state.payment.remainingAmount
    });
    
    // Fechar modal
    closePaymentModal();
    
    // Mostrar mensagem de sucesso
    setInfo(
      "info-ok",
      "Agendamento confirmado!",
      `Seu agendamento foi realizado com sucesso! Sinal de ${PAYMENT_CONFIG.formatBRL(state.payment.signalAmount)} será pago.`
    );
    
    // Enviar notificações
    await sendNotifications(booking);
    enableWhatsButton(booking);
    
    // Limpar formulário
    el.leadForm.reset();
    state.selectedSlot = null;
    
    // Recarregar horários disponíveis
    await refreshInitialSlots(state.selectedDate);
    
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    setInfo(
      "info-error",
      "Erro no processamento",
      "Não foi possível processar seu pagamento. Tente novamente."
    );
  }
}

function proceedToCardPayment() {
  // Implementar integração com gateway de pagamento
  // Por enquanto, simula pagamento confirmado
  alert('Redirecionando para página segura de pagamento...');
  // Aqui você integraria com Stripe, Mercado Pago, etc.
}

// Modificar função de confirmação original
async function confirmByWhatsapp() {
  if (!state.selectedBooking) return;
  
  // Rastreia clique no botão de agendamento
  trackAgendamentoClick();
  
  const message = buildClientMessage(state.selectedBooking);
  window.open(`https://api.whatsapp.com/send?phone=${STUDIO_WHATSAPP}&text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

async function refreshInitialSlots(dateISO) {
  if (!state.firebaseReady) {
    renderSlots(getLocalBookedHours(dateISO));
    return;
  }
  const q = query(collection(state.db, "agendamentos"), where("dateISO", "==", dateISO));
  const snapshot = await getDocs(q);
  const booked = [];
  snapshot.forEach((d) => {
    const row = d.data();
    // Ignorar apenas agendamentos cancelados
    if (row?.hour && row.status !== 'cancelado') {
      booked.push(row.hour);
    }
  });
  renderSlots(booked);
}

function initSchedulerEvents() {
  if (!el.dataAgendamento || !el.leadForm || !el.slotsGrid) return;

  el.dataAgendamento.min = todayStr();
  el.dataAgendamento.value = todayStr();
  state.selectedDate = el.dataAgendamento.value;
  renderSlots([]);

  el.dataAgendamento.addEventListener("change", async () => {
    state.selectedDate = el.dataAgendamento.value;
    state.selectedSlot = "";
    if (state.firebaseReady) {
      await refreshInitialSlots(state.selectedDate);
      await subscribeDay(state.selectedDate);
    }
  });

  el.slotsGrid.addEventListener("click", handleSlotsClick);

  el.leadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.firebaseReady) {
      setInfo("info-warn", "Configuração pendente", "Finalize o Firebase para liberar o agendamento em tempo real.");
      return;
    }

  if (!nome || !celular || !servico || !dateISO || !hour) {
    setInfo("info-warn", "Campos obrigatórios", "Preencha todos os campos para continuar.");
    return;
  }

  try {
    await ensureNoPastDate(dateISO);
    if (!servico) throw new Error("SERVICO_OBRIGATORIO");
    if (!hour) throw new Error("HORA_OBRIGATORIA");

    el.btnConfirmarSlot.disabled = true;
    el.btnConfirmarSlot.innerHTML = '<span class="loading-spinner"></span> Processando...';
    
    // Abrir modal de pagamento em vez de confirmar diretamente
    openPaymentModal(servico);
    
    // Reabilitar botão
    el.btnConfirmarSlot.disabled = false;
    el.btnConfirmarSlot.innerHTML = 'Confirmar agendamento';
    
  } catch (error) {
    el.btnConfirmarSlot.disabled = false;
    el.btnConfirmarSlot.innerHTML = 'Confirmar agendamento';
    
    if (error.message === "DATE_IN_PAST") {
      setInfo("info-warn", "Data inválida", "Selecione uma data futura para agendar.");
    } else if (error.message === "SERVICO_OBRIGATORIO") {
      setInfo("info-warn", "Serviço obrigatório", "Selecione o serviço desejado.");
    } else if (error.message === "HORA_OBRIGATORIA") {
      setInfo("info-warn", "Horário obrigatório", "Selecione um horário disponível.");
    } else {
      setInfo("info-error", "Erro ao processar", "Tente novamente em alguns instantes.");
    }
  }
});

  if (el.btnConfirmarWhats) {
    el.btnConfirmarWhats.addEventListener("click", confirmByWhatsapp);
  }
  
  if (el.btnCancelarAgendamento) {
    el.btnCancelarAgendamento.addEventListener("click", cancelCurrentBooking);
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

async function boot() {
  window.addEventListener("scroll", reveal);
  reveal();

  initMentoria();
  initSchedulerEvents();
  await initFirebase();

  state.selectedDate = el.dataAgendamento.value || todayStr();
  await refreshInitialSlots(state.selectedDate);
  await subscribeDay(state.selectedDate);
  if (state.mode === "firebase") {
    setInfo("info-ok", "Sistema online", "Agendamento em tempo real ativo. Escolha data e horário para reservar.");
  } else {
    setInfo("info-warn", "Modo local ativo", "Agendamento funcionando no site. Para sincronizar entre todos os clientes, conecte o Firebase.");
  }
}

boot();
