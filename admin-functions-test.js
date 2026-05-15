// 🧪 TESTE DE VALIDAÇÃO DAS FUNÇÕES GLOBAIS DO ADMIN
// Execute este código no console do navegador para validar todas as funções

console.log('🧪 Iniciando teste de validação das funções globais...');

// Lista de todas as funções que devem existir no escopo global
const requiredFunctions = [
  'syncRecoveryAgendamentos',
  'cleanOldBookings', 
  'loadHistory',
  'exportData',
  'blockTimeSlot',
  'unblockTimeSlot',
  'confirmarAgendamento',
  'cancelarAgendamentoAdmin',
  'enviarMensagemStatus',
  'enviarConfirmacaoCliente',
  'arquivarAtendimento',
  'confirmarSinal',
  'cancelarAgendamento',
  'marcarComoReembolsado',
  'updateBookingStatus'
];

let testResults = {
  passed: 0,
  failed: 0,
  missing: []
};

console.log('📋 Verificando funções no escopo global...');

requiredFunctions.forEach(functionName => {
  if (typeof window[functionName] === 'function') {
    console.log(`✅ ${functionName} - OK`);
    testResults.passed++;
  } else {
    console.log(`❌ ${functionName} - NÃO ENCONTRADA`);
    testResults.failed++;
    testResults.missing.push(functionName);
  }
});

// Resumo do teste
console.log('\n📊 RESUMO DO TESTE:');
console.log(`✅ Funções OK: ${testResults.passed}`);
console.log(`❌ Funções falhando: ${testResults.failed}`);

if (testResults.failed === 0) {
  console.log('🎉 TODAS AS FUNÇÕES ESTÃO ACESSÍVEIS! Botões devem funcionar corretamente.');
} else {
  console.log('⚠️ FUNÇÕES FALTANDO:', testResults.missing.join(', '));
  console.log('🔧 Verifique se estas funções estão definidas como window.functionName');
}

// Teste adicional: verificar se os elementos DOM existem
console.log('\n🔍 Verificando elementos DOM...');
const requiredElements = [
  'btnSyncRecovery',
  'btnCleanHistory', 
  'btnViewHistory',
  'btnExportData',
  'btnBlockTime',
  'btnUnblockTime',
  'menuToggle',
  'closeMenu',
  'closeHistoryModal'
];

let elementResults = {
  found: 0,
  missing: []
};

requiredElements.forEach(elementId => {
  const element = document.getElementById(elementId);
  if (element) {
    console.log(`✅ ${elementId} - OK`);
    elementResults.found++;
  } else {
    console.log(`❌ ${elementId} - NÃO ENCONTRADO`);
    elementResults.missing.push(elementId);
  }
});

console.log('\n📊 RESUMO DOS ELEMENTOS:');
console.log(`✅ Elementos encontrados: ${elementResults.found}`);
console.log(`❌ Elementos faltando: ${elementResults.missing.length}`);

if (elementResults.missing.length > 0) {
  console.log('⚠️ ELEMENTOS FALTANDO:', elementResults.missing.join(', '));
}

// Teste final: verificar se os event listeners estão funcionando
console.log('\n🎯 Teste final de conectividade...');
try {
  // Simular clique em cada botão (sem executar as funções)
  const buttons = document.querySelectorAll('.menu-item, .btn-action, .filter-btn');
  console.log(`🔘 Total de botões encontrados: ${buttons.length}`);
  
  if (buttons.length > 0) {
    console.log('✅ Botões detectados no DOM');
  } else {
    console.log('❌ Nenhum botão encontrado');
  }
} catch (error) {
  console.log('❌ Erro ao testar botões:', error.message);
}

console.log('\n🏁 TESTE CONCLUÍDO!');
