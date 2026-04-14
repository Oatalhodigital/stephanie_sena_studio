// Configuração de Preços e Pagamento
const PAYMENT_CONFIG = {
  // Preços dos serviços
  services: {
    'Manutenção até 15 dias': 65.00,
    'Manutenção mais de 25 dias': 85.00,
    'Manutenção + cutilagem + esmaltação em gel': 105.00,
    'Blindagem em Gel': 50.00,
    'Banho de Gel': 100.00,
    'Esmaltação em Gel': 35.00,
    'Alongamento': 140.00,
    'Encapsulada': 0, // Valores adicionais
    'Babyboomer': 0    // Valores adicionais
  },
  
  // Configurações de pagamento
  reservation: {
    percentage: 0.30, // 30% de sinal
    timeoutMinutes: 15,  // 15 minutos para pagamento
    
    // Configurações Pix
    pix: {
      key: '60.605.653 STEPHANIE SENA',
      name: 'STEPHANIE SENA RAMOS SILVA',
      city: 'SAO PAULO',
      payload: '00020126360014BR.GOV.BCB.PIX0114606056530001265204000053039865802BR592560.605.653 STEPHANIE SENA6009SAO PAULO62140510j02GXuQh5F630460D4'
    },
    
    // Configurações de pagamento
    paymentMethods: ['pix', 'cartao']
  },
  
  // Calcular valor do sinal
  calculateSignal(serviceName) {
    const servicePrice = this.services[serviceName] || 0;
    const signalAmount = servicePrice * this.reservation.percentage;
    const remainingAmount = servicePrice - signalAmount;
    
    return {
      servicePrice,
      signalAmount,
      remainingAmount,
      percentage: this.reservation.percentage * 100
    };
  },
  
  // Formatar valores em BRL
  formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  },
  
  // Gerar QR Code Pix com payload real
  getQRCodeURL(amount) {
    // Usa o payload Pix real do arquivo HTML
    const payload = this.reservation.pix.payload;
    
    // Gerar QR Code via API externa
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`;
  }
};

// Exportar para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PAYMENT_CONFIG;
} else if (typeof window !== 'undefined') {
  window.PAYMENT_CONFIG = PAYMENT_CONFIG;
}
