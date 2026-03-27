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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const STUDIO_WHATSAPP = "5531991105308";
const HOUR_START = 8;
const HOUR_END = 20;
const WEBHOOK_URL = ""; // opcional: URL do Make/Zapier para enviar notificacoes automáticas

const state = {
  db: null,
  firebaseReady: false,
  mode: "local",
  selectedDate: "",
  selectedSlot: "",
  activeUnsubscribe: null,
  selectedBooking: null
};

const el = {
  leadForm: document.getElementById("leadForm"),
  nome: document.getElementById("nome"),
  celular: document.getElementById("celular"),
  dataAgendamento: document.getElementById("dataAgendamento"),
  slotsGrid: document.getElementById("slotsGrid"),
  btnConfirmarSlot: document.getElementById("btnConfirmarSlot"),
  btnConfirmarWhats: document.getElementById("btnConfirmarWhats"),
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
  return (v || "").replace(/\D+/g, "");
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

function createHourSlots() {
  const list = [];
  for (let h = HOUR_START; h <= HOUR_END; h += 1) {
    list.push(`${String(h).padStart(2, "0")}:00`);
  }
  return list;
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
    const mod = await import("./firebase-config.js");
    if (mod && mod.firebaseConfig) return mod.firebaseConfig;
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
  const slots = createHourSlots();

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

function buildWhatsMessage(booking) {
  return (
    "Olá Stephanie! Novo agendamento confirmado pelo site.\n" +
    `Nome: ${booking.nome}\n` +
    `Celular: ${booking.celular}\n` +
    `Data: ${formatDateBR(booking.dateISO)}\n` +
    `Horário: ${booking.hour}`
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

async function bookSlot(formData) {
  if (!state.firebaseReady || !state.db) {
    const localBooking = {
      id: slotId(formData.dateISO, formData.hour),
      ...formData,
      status: "confirmado",
      createdAt: new Date().toISOString()
    };
    localSaveBooking(localBooking);
    return localBooking;
  }

  const { nome, celular, dateISO, hour } = formData;
  const id = slotId(dateISO, hour);
  const ref = doc(state.db, "agendamentos", id);

  await runTransaction(state.db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      throw new Error("SLOT_ALREADY_BOOKED");
    }
    tx.set(ref, {
      id,
      dateISO,
      hour,
      nome,
      celular,
      status: "confirmado",
      createdAt: serverTimestamp()
    });
  });

  return {
    id,
    dateISO,
    hour,
    nome,
    celular
  };
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
}

function confirmByWhatsapp() {
  if (!state.selectedBooking) return;
  const message = buildWhatsMessage(state.selectedBooking);
  window.open(`https://wa.me/${STUDIO_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
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
    if (row?.hour) booked.push(row.hour);
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

    const nome = (el.nome.value || "").trim();
    const celularRaw = (el.celular.value || "").trim();
    const celular = normalizePhone(celularRaw);
    const dateISO = el.dataAgendamento.value;
    const hour = state.selectedSlot;

    try {
      if (!nome || nome.length < 4) throw new Error("NOME_INVALIDO");
      if (!celular || celular.length < 10) throw new Error("CELULAR_INVALIDO");
      await ensureNoPastDate(dateISO);
      if (!hour) throw new Error("HORA_OBRIGATORIA");

      el.btnConfirmarSlot.disabled = true;
      const booking = await bookSlot({ nome, celular, dateISO, hour });
      await notifyWebhook(booking);

      setInfo(
        "info-ok",
        "Agendamento confirmado",
        `Reserva criada para ${formatDateBR(dateISO)} às ${hour}. Clique no botão abaixo para enviar a confirmação no WhatsApp.`
      );
      enableWhatsButton(booking);
      state.selectedSlot = "";
    } catch (error) {
      if (error.message === "SLOT_ALREADY_BOOKED") {
        setInfo("info-warn", "Horário indisponível", "Esse horário já foi reservado por outro cliente. Escolha outro horário.");
      } else if (error.message === "NOME_INVALIDO") {
        setInfo("info-error", "Nome inválido", "Digite seu nome completo para continuar.");
      } else if (error.message === "CELULAR_INVALIDO") {
        setInfo("info-error", "Celular inválido", "Digite um número de celular válido com DDD.");
      } else if (error.message === "DATA_INVALIDA") {
        setInfo("info-error", "Data inválida", "Selecione uma data de hoje em diante.");
      } else if (error.message === "HORA_OBRIGATORIA") {
        setInfo("info-error", "Horário obrigatório", "Selecione um horário disponível.");
      } else {
        setInfo("info-error", "Falha ao confirmar", "Não foi possível concluir agora. Tente novamente em alguns segundos.");
      }
    } finally {
      el.btnConfirmarSlot.disabled = false;
    }
  });

  if (el.btnConfirmarWhats) {
    el.btnConfirmarWhats.addEventListener("click", confirmByWhatsapp);
  }
}

function initMentoria() {
  if (!el.mentoriaForm) return;
  el.mentoriaForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = (el.mentoriaNome.value || "").trim();
    const msg =
      `Olá Stephanie! Meu nome é ${nome || "—"}. Tenho interesse na mentoria e gostaria de marcar uma visita para conhecer valores e datas.`;
    window.open(`https://wa.me/${STUDIO_WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
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
