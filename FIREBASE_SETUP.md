# Firebase Setup (agendamento em tempo real)

## 1) Criar projeto Firebase
- Acesse [Firebase Console](https://console.firebase.google.com/).
- Crie um projeto.
- Em "Firestore Database", crie banco no modo producao.
- Em "Configurações do projeto > Seus apps", registre app Web e copie o objeto de configuracao.

## 2) Configurar no site
- Copie `firebase-config.example.js` para `firebase-config.js`.
- Preencha as chaves do seu projeto.

## 3) Regras Firestore (minimo para funcionar)

Use regras iniciais (ajuste depois para maior seguranca):

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /agendamentos/{bookingId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }
  }
}
```

## 4) Estrutura dos documentos
- Colecao: `agendamentos`
- ID: `YYYY-MM-DD_HH:00` (ex.: `2026-03-26_15:00`)
- Campos: `nome`, `celular`, `dateISO`, `hour`, `status`, `createdAt`

## 5) Notificacoes automaticas (opcional)
- No arquivo `app.js`, configure `WEBHOOK_URL`.
- Aponte para um fluxo no Make/Zapier/n8n para enviar:
  - mensagem para o Studio
  - mensagem para o cliente

Sem webhook, o sistema ja confirma no site e disponibiliza botao de confirmacao via WhatsApp.
