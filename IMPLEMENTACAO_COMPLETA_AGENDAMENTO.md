# Implementação Completa do Sistema de Agendamento
## Studio Stephanie Sena - Firebase Firestore + Double Booking Prevention

**Data:** 03/07/2026  
**Status:** ✅ IMPLEMENTAÇÃO COMPLETA E OTIMIZADA

---

## 📋 Índice

1. [Estrutura de Dados Firebase](#1-estrutura-de-dados-firebase)
2. [Lógica de Bloqueio de Horários (Front-end)](#2-lógica-de-bloqueio-de-horários-front-end)
3. [Função de Agendamento com Transação](#3-função-de-agendamento-com-transação)
4. [Painel Administrativo - Listener em Tempo Real](#4-painel-administrativo---listener-em-tempo-real)
5. [CSS para Bloqueio Visual](#5-css-para-bloqueio-visual)
6. [Testes e Validação](#6-testes-e-validação)

---

## 1. Estrutura de Dados Firebase

### Coleção: `agendamentos`

**ID do Documento:** `{dateISO}_{hour}` (ex: `2026-07-04_14:00`)

**Campos do Documento:**

```javascript
{
  // Identificação
  id: "2026-07-04_14:00",  // Auto-gerado pela função slotId()
  
  // Dados do Cliente
  nome: "Maria Silva",
  celular: "5531993627475",  // WhatsApp formatado (código país + DDD + número)
  servico: "Alongamento em gel",
  
  // Data e Horário
  dateISO: "2026-07-04",  // Formato YYYY-MM-DD para fácil filtragem
  hour: "14:00",  // Formato HH:MM
  
  // Status do Agendamento
  status: "confirmado" | "pendente" | "cancelado" | "bloqueado" | "pago" | "pago_confirmado" | "pago_pendente",
  
  // Status Financeiro (opcional)
  statusFinanceiro: "aguardando_pagamento" | "pendente_confirmacao" | "pago" | "pagamento_recusado",
  
  // Valores (opcional)
  valorTotal: 140.00,
  valorSinal: 42.00,  // 30% do valor total
  valorRestante: 98.00,
  
  // Pagamento (opcional)
  pagamentoId: "manual_1234567890",
  metodoPagamento: "pix",
  
  // Timestamps
  createdAt: serverTimestamp(),  // Timestamp do servidor Firebase
  updatedAt: serverTimestamp(),  // Timestamp de última atualização
  
  // Metadados (opcional)
  arquivado: false,
  blockedBy: "admin"  // Se bloqueado manualmente pelo admin
}
```

### Coleção: `horarios_bloqueados` (Opcional)

**ID do Documento:** `{dateISO}_{hour}`

**Campos do Documento:**

```javascript
{
  dateISO: "2026-07-04",
  hour: "14:00",
  blockedBy: "admin",
  motivo: "Férias",
  createdAt: serverTimestamp()
}
```

---

## 2. Lógica de Bloqueio de Horários (Front-end)

### Função `subscribeDay()` - Listener em Tempo Real

**Arquivo:** `app.js` (linhas 294-379)

```javascript
async function subscribeDay(dateISO) {
  try {
    if (!dateISO) return;

    console.log('📅 subscribeDay chamado para data:', dateISO);

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
          console.log('🔄 Snapshot recebido para data:', dateISO, 'Documentos:', agendamentosSnapshot.docs.length);
          const booked = [];
          
          // Processar agendamentos
          agendamentosSnapshot.forEach((d) => {
            const row = d.data();
            console.log('📋 Documento:', row);
            
            // CORREÇÃO CRÍTICA: Horários cancelados DEVEM ser liberados imediatamente
            // Apenas status 'confirmado', 'pendente', 'bloqueado', 'pago', 'pago_confirmado' ocupam o horário
            // Status 'cancelado' libera o horário para novos agendamentos
            if (row?.hour && (
              row.status === 'confirmado' || 
              row.status === 'pendente' || 
              row.status === 'bloqueado' || 
              row.status === 'pago' || 
              row.status === 'pago_confirmado' || 
              row.status === 'pago_pendente'
            )) {
              booked.push(row.hour);
              console.log('✅ Horário ocupado adicionado:', row.hour, 'Status:', row.status);
            }
          });

          // Buscar horários bloqueados manualmente pelo admin (opcional)
          try {
            const bloqueadosSnapshot = await getDocs(bloqueadosQuery);
            bloqueadosSnapshot.forEach((d) => {
              const row = d.data();
              if (row?.hour) {
                booked.push(row.hour);
                console.log('🔒 Horário bloqueado adicionado:', row.hour);
              }
            });
          } catch (error) {
            // Silenciar erro de permissão - a coleção pode não existir ou não ter regras configuradas
            // O site continua funcionando normalmente sem horários bloqueados
            console.log('Horários bloqueados não disponíveis (coleção pode não existir)');
          }

          console.log('📊 Lista final de horários ocupados:', booked);

          // Limpar seleção se o horário selecionado foi ocupado
          if (state.selectedSlot && booked.includes(state.selectedSlot)) {
            state.selectedSlot = "";
          }
          
          // Renderizar slots com horários ocupados
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
  } catch (error) {
    console.error('Erro ao inscrever em atualizações em tempo real:', error);
    renderSlots([]);
  }
}
```

### Função `renderSlots()` - Renderização Visual com Bloqueio

**Arquivo:** `app.js` (linhas 249-281)

```javascript
function renderSlots(bookedHourList) {
  if (!el.slotsGrid) return;
  const selected = state.selectedSlot;
  const booked = new Set(bookedHourList || []);
  const slots = createHourSlots(state.selectedDate);

  console.log('🎨 renderSlots chamado com horários ocupados:', bookedHourList);
  console.log('🎨 Horários disponíveis para renderizar:', slots);

  el.slotsGrid.innerHTML = "";
  slots.forEach((hour) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot-btn";
    b.textContent = hour;
    b.dataset.hour = hour;

    if (booked.has(hour)) {
      // 🎨 BLOQUEIO VISUAL DE HORÁRIOS OCUPADOS
      b.classList.add("is-booked");
      b.disabled = true;
      b.style.textDecoration = "line-through";  // Texto riscado
      b.style.opacity = "0.4";  // Opacidade reduzida
      b.style.cursor = "not-allowed";  // Cursor não permitido
      b.title = "Horário já reservado";  // Tooltip explicativo
      console.log('🔒 Horário bloqueado visualmente:', hour);
    } else if (hour === selected) {
      b.classList.add("is-selected");
    }
    el.slotsGrid.appendChild(b);
  });

  console.log('🎨 Total de botões renderizados:', slots.length);
}
```

---

## 3. Função de Agendamento com Transação

### Função `bookSlot()` - Agendamento Básico com Transação

**Arquivo:** `app.js` (linhas 475-539)

```javascript
async function bookSlot(formData) {
  // Força uso do Firebase - sem fallback para localStorage
  if (!state.firebaseReady || !state.db) {
    throw new Error("Firebase não está pronto. Por favor, recarregue a página.");
  }

  const { nome, celular, dateISO, hour, servico } = formData;
  
  // VALIDAÇÃO DE SEGURANÇA - Garante que as regras sejam respeitadas
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
  
  const id = slotId(dateISO, hour);
  const ref = doc(state.db, "agendamentos", id);
  
  try {
    // 🔒 USO DE TRANSAÇÃO PARA PREVENIR DOUBLE-BOOKING
    // A transação garante atomicidade: verifica e grava em uma operação atômica
    // Isso impede que duas pessoas cliquem no mesmo milissegundo no mesmo horário
    await runTransaction(state.db, async (transaction) => {
      const docSnap = await transaction.get(ref);
      
      if (docSnap.exists()) {
        const existingData = docSnap.data();
        // Se o horário já está ocupado e não foi cancelado, aborta a transação
        if (existingData.status !== 'cancelado') {
          console.log('❌ Horário já ocupado, abortando transação:', existingData);
          throw new Error("SLOT_ALREADY_BOOKED");
        }
      }
      
      // Se o horário está livre ou foi cancelado, cria/atualiza o agendamento
      transaction.set(ref, {
        nome,
        celular,
        servico,
        dateISO,
        hour,
        status: AGENDAMENTO_STATUS.PENDENTE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log('✅ Transação concluída com sucesso para:', id);
    });

    const booking = {
      id,
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
```

### Função `bookSlotWithPayment()` - Agendamento com Pagamento e Transação

**Arquivo:** `app.js` (linhas 772-827)

```javascript
async function bookSlotWithPayment(formData) {
  if (!state.firebaseReady || !state.db) {
    throw new Error("Firebase não está pronto. Por favor, recarregue a página.");
  }

  const { nome, celular, servico, dateISO, hour, valorTotal, valorSinal, valorRestante, pagamentoId, metodoPagamento, statusFinanceiro } = formData;
  const id = slotId(dateISO, hour);
  const ref = doc(state.db, "agendamentos", slotId(dateISO, hour));

  console.log('💾 bookSlotWithPayment chamado para:', { dateISO, hour, nome });
  
  // 🔒 USO DE TRANSAÇÃO PARA PREVENIR DOUBLE-BOOKING
  // A transação garante atomicidade: verifica e grava em uma operação atômica
  try {
    await runTransaction(state.db, async (transaction) => {
      const docSnap = await transaction.get(ref);
      
      if (docSnap.exists()) {
        const existingData = docSnap.data();
        console.log('⚠️ Documento já existe:', existingData);
        // Se o horário já está ocupado e não foi cancelado, aborta a transação
        if (existingData.status !== 'cancelado') {
          console.log('❌ Horário já ocupado, abortando transação');
          throw new Error("SLOT_ALREADY_BOOKED");
        }
      }
      
      // Se o horário está livre ou foi cancelado, cria/atualiza o agendamento
      console.log('✅ Salvando novo agendamento no Firestore via transação...');
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
      }, { merge: true });
      console.log('✅ Transação concluída com sucesso!');
    });
  } catch (error) {
    console.error('Erro ao salvar no Firestore:', error);
    throw error;
  }

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
```

### Por que usar Transação?

**Problema:** Sem transação, dois clientes podem clicar no mesmo horário quase simultaneamente:
1. Cliente A verifica se o horário está livre (sim)
2. Cliente B verifica se o horário está livre (sim)
3. Cliente A grava o agendamento
4. Cliente B grava o agendamento (sobrescreve A ou cria duplicata)

**Solução com Transação:**
- A transação garante que a verificação e a gravação sejam **atômicas**
- Se dois clientes tentarem agendar o mesmo horário simultaneamente, o Firebase garante que apenas uma transação será bem-sucedida
- A segunda transação falhará com erro, permitindo avisar o usuário para escolher outro horário

---

## 4. Painel Administrativo - Listener em Tempo Real

### Função `loadBookings()` - Listener Global com onSnapshot

**Arquivo:** `admin.js` (linhas 557-636)

```javascript
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
      
      // Mapear documentospara array
      allBookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Aplicar filtros e renderizar
      filterBookings();
      
      // 📋 Mostrar notificação de novos agendamentos
      const novosAgendamentos = snapshot.docChanges().filter(change => 
        change.type === 'added' && !change.doc.metadata.hasPendingWrites
      );
      
      if (novosAgendamentos.length > 0) {
        console.log(`📋 ${novosAgendamentos.length} novo(s) agendamento(s) recebido(s)`);
        showNotification(`${novosAgendamentos.length} novo(s) agendamento(s) recebido(s)`);
      }
      
      // ❌ Detectar cancelamentos e mostrar notificação
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
      
      // 🔄 TENTATIVA DE RECONEXÃO AUTOMÁTICA com exponential backoff
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

// Limpeza ao fechar a página
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
```

### Função `showNotification()` - Notificação Visual

**Arquivo:** `admin.js` (linhas 650-678)

```javascript
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
```

---

## 5. CSS para Bloqueio Visual

### Estilos para Horários Bloqueados

**Arquivo:** `style.css` (adicione estas classes se não existirem)

```css
/* Botão de horário disponível */
.slot-btn {
  padding: 12px 20px;
  margin: 8px;
  border: 2px solid var(--dourado);
  background: white;
  color: var(--preto);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  font-family: 'Poppins', sans-serif;
}

.slot-btn:hover {
  background: var(--dourado);
  color: var(--preto);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
}

/* Botão de horário selecionado */
.slot-btn.is-selected {
  background: var(--dourado);
  color: var(--preto);
  border-color: var(--dourado);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
}

/* 🎨 BLOQUEIO VISUAL DE HORÁRIOS OCUPADOS */
.slot-btn.is-booked {
  opacity: 0.4;                    /* Opacidade reduzida */
  text-decoration: line-through;  /* Texto riscado */
  cursor: not-allowed;             /* Cursor não permitido */
  background: #f0f0f0;              /* Fundo cinza claro */
  border-color: #ccc;              /* Borda cinza */
  color: #999;                     /* Texto cinza */
  pointer-events: none;            /* Impede clique */
}

/* Animação de notificação */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

---

## 6. Testes e Validação

### Teste 1: Sincronização Cliente → Painel

**Procedimento:**
1. Cliente seleciona data e horário no site
2. Cliente preenche dados e confirma pagamento
3. Agendamento é salvo no Firebase com transação
4. Painel administrativo recebe notificação instantânea
5. Card do agendamento aparece na lista do painel

**Resultado Esperado:** ✅ Sincronização funciona corretamente em tempo real

### Teste 2: Bloqueio Visual de Horários

**Procedimento:**
1. Cliente seleciona uma data
2. Sistema consulta Firebase para horários ocupados
3. Horários já agendados aparecem riscados e desabilitados
4. Cliente não consegue selecionar horários ocupados

**Resultado Esperado:** ✅ Bloqueio visual e lógico funcionando corretamente

### Teste 3: Liberação de Horários

**Procedimento:**
1. Admin cancela um agendamento no painel
2. Status muda para 'cancelado' no Firebase
3. Horário é liberado automaticamente no site
4. Cliente pode selecionar o horário novamente

**Resultado Esperado:** ✅ Liberação automática funcionando corretamente

### Teste 4: Prevenção de Double-Booking

**Procedimento:**
1. Dois clientes tentam agendar o mesmo horário simultaneamente
2. Apenas um agendamento é bem-sucedido
3. O segundo recebe erro "SLOT_ALREADY_BOOKED"
4. Sistema sugere outro horário disponível

**Resultado Esperado:** ✅ Transação previne double-booking com sucesso

### Teste 5: Reconexão Automática

**Procedimento:**
1. Desconectar a internet
2. Painel mostra erro de conexão
3. Reconectar a internet
4. Sistema reconecta automaticamente após 5 segundos
5. Agendamentos são atualizados

**Resultado Esperado:** ✅ Reconexão automática funciona corretamente

---

## 7. Resumo das Implementações

### ✅ Funcionalidades Implementadas

1. **Estrutura de Dados Firebase**
   - Coleção `agendamentos` com campos completos
   - ID consistente: `{dateISO}_{hour}`
   - Timestamps automáticos com `serverTimestamp()`

2. **Bloqueio Visual de Horários**
   - Opacidade reduzida (`opacity: 0.4`)
   - Texto riscado (`text-decoration: line-through`)
   - Cursor não permitido (`cursor: not-allowed`)
   - Botão desabilitado (`disabled = true`)
   - Tooltip explicativo

3. **Prevenção de Double-Booking**
   - Uso de `runTransaction()` para atomicidade
   - Verificação antes da gravação
   - Tratamento de erro "SLOT_ALREADY_BOOKED"
   - Implementado em `bookSlot()` e `bookSlotWithPayment()`

4. **Sincronização em Tempo Real**
   - Listener `onSnapshot()` no cliente para horários ocupados
   - Listener `onSnapshot()` no painel para todos os agendamentos
   - Notificações visuais de novos agendamentos
   - Notificações de cancelamentos

5. **Reconexão Automática**
   - Exponential backoff até 30 segundos
   - Máximo de 5 tentativas
   - Limpeza automática de listeners

6. **Liberação Automática**
   - Horários cancelados são liberados automaticamente
   - Listener atualiza UI instantaneamente
   - Status 'cancelado' não ocupa horário

---

## 8. Próximos Passos (Opcionais)

1. **Monitoramento:** Adicionar logging detalhado em produção
2. **Backup:** Implementar backup automático do Firestore
3. **Segurança:** Refinar regras de segurança do Firestore
4. **UX:** Adicionar indicador de carregamento durante transações
5. **Analytics:** Integrar Firebase Analytics para métricas de agendamentos

---

**Documentação gerada automaticamente por Cascade AI Assistant**  
**Projeto: Studio Stephanie Sena - Sistema de Agendamento Online**  
**Data: 03/07/2026**
