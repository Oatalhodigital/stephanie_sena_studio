// Teste definitivo da correção

console.log("=== TESTE DEFINITIVO DA CORREÇÃO ===");

// Função corrigida definitivamente
function createHourSlotsFixed(selectedDate) {
    const list = [];
    // CORREÇÃO DEFINITIVA: Usar new Date(selectedDate) que funciona corretamente
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda-feira, 6 = Sábado
    
    console.log(`\nData: ${selectedDate}`);
    console.log(`new Date("${selectedDate}"): ${date}`);
    console.log(`getDay(): ${dayOfWeek} (${['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][dayOfWeek]})`);
    
    // DOMINGOS: Remover completamente a disponibilidade
    if (dayOfWeek === 0) {
        console.log("-> DOMINGO: Sem horários disponíveis");
        return [];
    }
    
    // SEGUNDAS-FEIRAS: Horário fixo de 09:30 às 17:00
    if (dayOfWeek === 1) {
        console.log("-> SEGUNDA-FEIRA: 09:30, 11:00, 12:30, 14:00, 15:30");
        for (let h = 9.5; h <= 17; h += 1.5) {
            const hour = Math.floor(h);
            const minutes = (h - hour) * 60;
            list.push(`${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
        }
        return list;
    }
    
    // TERÇA A SÁBADO: Mantém configuração padrão
    const isWeekend = dayOfWeek === 6;
    const lastHour = isWeekend ? 20 : 17;
    console.log(`-> ${['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][dayOfWeek]}: Configuração padrão até ${lastHour}:00`);
    
    for (let h = 8; h <= lastHour; h += 1.5) {
        const hour = Math.floor(h);
        const minutes = (h - hour) * 60;
        list.push(`${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
    }
    
    console.log(`Horários gerados: [${list.join(', ')}]`);
    return list;
}

// Teste final completo
console.log("\n=== TESTE FINAL COMPLETO ===");

const testDates = [
    { date: "2026-05-11", expectedDay: 0, expectedName: "Domingo", description: "Domingo - sem horários" },
    { date: "2026-05-12", expectedDay: 1, expectedName: "Segunda-feira", description: "Segunda - horário especial 09:30-17:00" },
    { date: "2026-05-13", expectedDay: 2, expectedName: "Terça-feira", description: "Terça - padrão 08:00-17:00" },
    { date: "2026-05-14", expectedDay: 3, expectedName: "Quarta-feira", description: "Quarta - padrão 08:00-17:00" },
    { date: "2026-05-15", expectedDay: 4, expectedName: "Quinta-feira", description: "Quinta - padrão 08:00-17:00" },
    { date: "2026-05-16", expectedDay: 5, expectedName: "Sexta-feira", description: "Sexta - padrão 08:00-17:00" },
    { date: "2026-05-17", expectedDay: 6, expectedName: "Sábado", description: "Sábado - padrão 08:00-20:00" },
];

let allCorrect = true;
const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

testDates.forEach(({ date, expectedDay, expectedName, description }) => {
    console.log(`\n--- ${description} ---`);
    
    const testDate = new Date(date);
    const actualDay = testDate.getDay();
    const actualName = dayNames[actualDay];
    
    const dayCorrect = actualDay === expectedDay && actualName === expectedName;
    
    console.log(`Data: ${date}`);
    console.log(`Esperado: ${expectedName} (${expectedDay})`);
    console.log(`Obtido: ${actualName} (${actualDay})`);
    console.log(`Resultado: ${dayCorrect ? '✅ CORRETO' : '❌ INCORRETO'}`);
    
    if (dayCorrect) {
        const slots = createHourSlotsFixed(date);
        
        // Verificar quantidade de horários esperados
        let expectedSlots;
        if (expectedDay === 0) expectedSlots = 0; // Domingo
        else if (expectedDay === 1) expectedSlots = 5; // Segunda (09:30, 11:00, 12:30, 14:00, 15:30)
        else if (expectedDay === 6) expectedSlots = 8; // Sábado (08:00, 09:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00)
        else expectedSlots = 6; // Terça a Sexta
        
        const slotsCorrect = slots.length === expectedSlots;
        console.log(`Horários esperados: ${expectedSlots}, obtidos: ${slots.length} ${slotsCorrect ? '✅' : '❌'}`);
        
        if (!slotsCorrect) {
            allCorrect = false;
        }
    } else {
        allCorrect = false;
    }
});

console.log("\n=== RESULTADO FINAL ===");
if (allCorrect) {
    console.log("🎉 SUCESSO! O problema de deslocamento de dias foi completamente resolvido!");
    console.log("\n✅ Verificações passadas:");
    console.log("- Domingos mostram 'Sem horários disponíveis'");
    console.log("- Segundas mostram horários especiais 09:30-17:00");
    console.log("- Terça a Sexta mostram configuração padrão 08:00-17:00");
    console.log("- Sábados mostram configuração padrão 08:00-20:00");
    console.log("- Não há mais deslocamento de dias da semana");
} else {
    console.log("❌ FALHA: A correção não resolveu completamente o problema.");
}
