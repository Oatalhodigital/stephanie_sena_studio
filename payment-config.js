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
      key: 'studio-stephanie-sena@pix.com.br',
      name: 'Studio Stephanie Sena',
      city: 'Belo Horizonte'
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
  
  // Usar QR Code personalizado
  getQRCodePath(amount) {
    // Retorna o caminho para o QR Code personalizado
    return 'QR Code/qr-code-pix.png';
  }
};

// Exportar para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PAYMENT_CONFIG;
} else if (typeof window !== 'undefined') {
  window.PAYMENT_CONFIG = PAYMENT_CONFIG;
}
