// Teste para debug do problema de deslocamento de dias da semana

// Teste 1: Verificar como new Date() trata diferentes formatos de data
console.log("=== TESTE 1: FORMATAÇÃO DE DATAS ===");

const today = new Date();
console.log("Data atual:", today);
console.log("toISOString():", today.toISOString());
console.log("toISOString().split('T')[0]:", today.toISOString().split('T')[0]);
console.log("getDay():", today.getDay(), "(0=Domingo, 1=Segunda, ...)");

// Teste 2: Simular data específica
console.log("\n=== TESTE 2: DATA ESPECÍFICA ===");
const testDateStr = "2026-05-12"; // Uma segunda-feira
const testDate = new Date(testDateStr);
console.log("Data string:", testDateStr);
console.log("new Date():", testDate);
console.log("getDay():", testDate.getDay(), "(deveria ser 1 para segunda-feira)");

// Teste 3: Verificar problema de fuso horário
console.log("\n=== TESTE 3: FUSO HORÁRIO ===");
const utcDate = new Date("2026-05-12T00:00:00.000Z");
console.log("UTC Date:", utcDate);
console.log("getDay() UTC:", utcDate.getDay());
console.log("getHours() UTC:", utcDate.getHours());

const localDate = new Date("2026-05-12");
console.log("Local Date:", localDate);
console.log("getDay() Local:", localDate.getDay());
console.log("getHours() Local:", localDate.getHours());

// Teste 4: Verificar como o calendário está passando a data
console.log("\n=== TESTE 4: SIMULAÇÃO DO CALENDÁRIO ===");
function simulateCalendarChange(dateStr) {
    console.log(`\nData selecionada no calendário: ${dateStr}`);
    const date = new Date(dateStr);
    console.log("new Date(dateStr):", date);
    console.log("getDay():", date.getDay());
    
    // Mapeamento esperado
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    console.log("Dia da semana:", dayNames[date.getDay()]);
    
    // Testar a função createHourSlots
    console.log("Horários que seriam gerados:");
    
    // DOMINGOS: Remover completamente a disponibilidade
    if (date.getDay() === 0) {
        console.log("-> DOMINGO: Sem horários disponíveis");
    }
    // SEGUNDAS-FEIRAS: Horário fixo de 09:30 às 17:00
    else if (date.getDay() === 1) {
        console.log("-> SEGUNDA-FEIRA: 09:30, 11:00, 12:30, 14:00, 15:30");
    }
    // TERÇA A SÁBADO: Mantém configuração padrão
    else {
        const isWeekend = date.getDay() === 6;
        const lastHour = isWeekend ? 20 : 17;
        console.log(`-> ${dayNames[date.getDay()]}: Configuração padrão até ${lastHour}:00`);
    }
}

// Testar com diferentes datas
simulateCalendarChange("2026-05-11"); // Domingo
simulateCalendarChange("2026-05-12"); // Segunda-feira
simulateCalendarChange("2026-05-13"); // Terça-feira
simulateCalendarChange("2026-05-14"); // Quarta-feira
