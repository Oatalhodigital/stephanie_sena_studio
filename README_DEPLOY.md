# Deploy do Sistema de Agendamento - Studio Stephanie Sena

## 📋 Estrutura Implementada

### ✅ Frontend (Completo)
- **Firebase Config**: Credenciais configuradas em `firebase-config.js`
- **Persistência**: Agendamentos salvos na coleção `agendamentos` com status (pendente/confirmado/cancelado)
- **Bloqueio de Horários**: Tempo real - horários ocupados ficam desabilitados
- **Notificações WhatsApp**: Automáticas para dona e cliente ao confirmar
- **Feedback Visual**: Loading spinner e mensagens de sucesso/erro
- **Interface Responsiva**: Formulário validado e experiência otimizada

### ✅ Backend (Cloud Functions)
- **Lembrete Automático**: 2 horas antes do atendimento
- **Processamento de Respostas**: [1] Confirmar / [2] Cancelar
- **Reabertura Automática**: Horários liberados ao cancelar
- **Limpeza de Dados**: Remoção automática de registros antigos

## 🚀 Passos para Deploy

### 1. Instalar Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login no Firebase
```bash
firebase login
```

### 3. Inicializar Projeto (se ainda não feito)
```bash
firebase init
# Selecionar: Functions, Firestore, Hosting
# Usar arquivos de configuração existentes
```

### 4. Instalar Dependências das Functions
```bash
cd functions
npm install
cd ..
```

### 5. Deploy Firestore Rules e Indexes
```bash
firebase deploy --only firestore
```

### 6. Deploy Functions
```bash
firebase deploy --only functions
```

### 7. Deploy Hosting
```bash
firebase deploy --only hosting
```

## 🧪 Testes Locais

### Emulator Suite
```bash
firebase emulators:start
```
Acesse:
- Firestore Emulator: http://localhost:4000/firestore
- Functions Emulator: http://localhost:4001

### Testar Functions Localmente
```bash
# Testar lembrete
firebase functions:shell
> sendReminderNotification()

# Testar resposta WhatsApp
curl -X POST http://localhost:5001/studio-stephanie-sena/us-central1/processWhatsAppResponse \
  -H "Content-Type: application/json" \
  -d '{"phone":"5531999999999","message":"1","bookingId":"2024-03-28_14:00"}'
```

## 📱 Fluxo Completo de Agendamento

### 1. Cliente Agenda no Site
- Preenche nome, WhatsApp, data e horário
- Sistema salva com status "pendente"
- WhatsApp automático para dona e cliente

### 2. Lembrete Automático (2h antes)
- Cloud Function envia mensagem com opções [1] Confirmar [2] Cancelar
- Cliente responde via WhatsApp

### 3. Processamento da Resposta
- **[1] Confirmar**: Status muda para "confirmado"
- **[2] Cancelar**: Status muda para "cancelado" e horário é liberado

### 4. Interface em Tempo Real
- Horários ocupados aparecem cinza/desabilitados
- Atualização automática quando outros clientes agendam

## 🔧 Configurações Adicionais

### Webhook WhatsApp (Opcional)
Para integração real com WhatsApp API, configure:
```javascript
const WEBHOOK_URL = "https://seu-webhook-url.com/whatsapp";
```

### Variáveis de Ambiente
```bash
firebase functions:config:set whatsapp.number="5531991105308"
firebase functions:config:set whatsapp.webhook="https://..."
```

## 📊 Estrutura do Firestore

### Coleção: agendamentos
```javascript
{
  id: "2024-03-28_14:00",
  dateISO: "2024-03-28",
  hour: "14:00",
  nome: "Nome do Cliente",
  celular: "5531999999999",
  status: "pendente", // "confirmado" | "cancelado"
  createdAt: timestamp,
  updatedAt: timestamp,
  reminderSent: boolean,
  reminderSentAt: timestamp
}
```

## 🚨 Importante

1. **Segurança**: Nunca faça commit do `firebase-config.js` em repositórios públicos
2. **Testes**: Teste todo o fluxo antes do deploy em produção
3. **WhatsApp**: Para mensagens automáticas reais, configure API de WhatsApp
4. **Monitoramento**: Use Firebase Console para monitorar Functions e Firestore

## 🆘 Suporte

- Firebase Console: https://console.firebase.google.com/
- Documentação: https://firebase.google.com/docs
- Logs das Functions: `firebase functions:log`
