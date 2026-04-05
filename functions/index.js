const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const STUDIO_WHATSAPP = '5531991705308';

// Função para enviar lembrete 2 horas antes do agendamento
exports.sendReminderNotification = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async (context) => {
    console.log('Iniciando verificação de lembretes...');
    
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    // Formata para YYYY-MM-DD HH:00
    const targetDate = twoHoursFromNow.toISOString().split('T')[0];
    const targetHour = String(twoHoursFromNow.getHours()).padStart(2, '0') + ':00';
    
    console.log(`Verificando agendamentos para ${targetDate} às ${targetHour}`);
    
    try {
      const snapshot = await db.collection('agendamentos')
        .where('dateISO', '==', targetDate)
        .where('hour', '==', targetHour)
        .where('status', '==', 'pendente')
        .get();
      
      if (snapshot.empty) {
        console.log('Nenhum agendamento encontrado para lembrete.');
        return null;
      }
      
      const promises = [];
      
      snapshot.forEach(doc => {
        const booking = doc.data();
        console.log(`Enviando lembrete para: ${booking.nome}`);
        
        // Constrói mensagem de lembrete
        const reminderMessage = `⏰ *LEMBRETE DE AGENDAMENTO* ⏰\n\n` +
          `Olá, ${booking.nome}!\n\n` +
          `Seu atendimento no Studio Stephanie Sena é daqui a 2 horas:\n` +
          `📅 *Data:* ${booking.dateISO.split('-').reverse().join('/')}\n` +
          `⏰ *Horário:* ${booking.hour}\n\n` +
          `Por favor, confirme sua presença:\n` +
          `[1] ✅ Confirmar presença\n` +
          `[2] ❌ Cancelar agendamento\n\n` +
          `Responda com 1 ou 2 para continuarmos! 📞`;
        
        // Envia notificação via WhatsApp (usando webhook URL se configurado)
        const notification = {
          to: booking.celular,
          message: reminderMessage,
          bookingId: booking.id,
          type: 'reminder'
        };
        
        // Aqui você pode integrar com API de WhatsApp ou webhook
        // Por enquanto, apenas loga e atualiza status
        console.log('Lembrete processado:', notification);
        
        // Opcional: atualiza status para "lembrado"
        promises.push(
          db.collection('agendamentos').doc(booking.id).update({
            reminderSent: true,
            reminderSentAt: admin.firestore.FieldValue.serverTimestamp()
          })
        );
      });
      
      await Promise.all(promises);
      console.log('Lembretes enviados com sucesso!');
      
      return null;
    } catch (error) {
      console.error('Erro ao enviar lembretes:', error);
      return null;
    }
  });

// Função para processar respostas de WhatsApp
exports.processWhatsAppResponse = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }
  
  try {
    const { phone, message, bookingId } = req.body;
    
    if (!phone || !message || !bookingId) {
      return res.status(400).send('Missing required fields');
    }
    
    // Busca o agendamento
    const bookingDoc = await db.collection('agendamentos').doc(bookingId).get();
    
    if (!bookingDoc.exists) {
      return res.status(404).send('Booking not found');
    }
    
    const booking = bookingDoc.data();
    
    // Processa a resposta
    if (message.trim() === '1') {
      // Confirmar presença
      await db.collection('agendamentos').doc(bookingId).update({
        status: 'confirmado',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Envia confirmação para o cliente
      const confirmMessage = `✅ *PRESENÇA CONFIRMADA* ✅\n\n` +
        `Obrigada, ${booking.nome}!\n\n` +
        `Sua presença foi confirmada para:\n` +
        `📅 ${booking.dateISO.split('-').reverse().join('/')}\n` +
        `⏰ ${booking.hour}\n\n` +
        `Aguardamos você no Studio! 💅✨`;
      
      console.log('Presença confirmada:', bookingId);
      
    } else if (message.trim() === '2') {
      // Cancelar agendamento
      await db.collection('agendamentos').doc(bookingId).update({
        status: 'cancelado',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Envia confirmação de cancelamento
      const cancelMessage = `❌ *AGENDAMENTO CANCELADO* ❌\n\n` +
        `Seu agendamento foi cancelado conforme solicitado.\n\n` +
        `Se desejar remarcar, acesse nosso site novamente.\n` +
        `Obrigada pelo aviso! 📞`;
      
      console.log('Agendamento cancelado:', bookingId);
      
      // Notifica a dona do studio sobre o cancelamento
      const studioNotification = `🔔 *CANCELAMENTO RECEBIDO*\n\n` +
        `Cliente: ${booking.nome}\n` +
        `Celular: ${booking.celular}\n` +
        `Data: ${booking.dateISO.split('-').reverse().join('/')}\n` +
        `Horário: ${booking.hour}\n\n` +
        `Horário liberado para novos agendamentos.`;
      
      console.log('Notificação de cancelamento enviada para o studio');
    }
    
    res.status(200).send('Response processed successfully');
    
  } catch (error) {
    console.error('Erro ao processar resposta:', error);
    res.status(500).send('Internal server error');
  }
});

// Função para limpar agendamentos antigos (opcional)
exports.cleanupOldBookings = functions.pubsub
  .schedule('0 2 * * *') // Todos os dias às 2AM
  .onRun(async (context) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 dias atrás
    
    try {
      const snapshot = await db.collection('agendamentos')
        .where('createdAt', '<', cutoffDate)
        .where('status', 'in', ['cancelado', 'confirmado'])
        .get();
      
      const batch = db.batch();
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Limpos ${snapshot.size} agendamentos antigos`);
      
      return null;
    } catch (error) {
      console.error('Erro ao limpar agendamentos antigos:', error);
      return null;
    }
  });
