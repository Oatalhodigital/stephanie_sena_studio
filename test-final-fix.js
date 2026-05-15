// Teste final da correção de parsing explícito

console.log("=== TESTE FINAL DA CORREÇÃO ===");

// Função corrigida
function createHourSlotsFixed(selectedDate) {
    const list = [];
    // CORREÇÃO FINAL: Parsing explícito para garantir interpretação local correta
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day); // Mês é 0-indexado no JS
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda-feira, 6 = Sábado
    
    console.log(`\nData: ${selectedDate}`);
    console.log(`Parsing: year=${year}, month=${month-1}, day=${day}`);
    console.log(`new Date(): ${date}`);
    console.log(`getDay(): ${dayOfWeek} (${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek]})`);
    
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
    console.log(`-> ${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek]}: Configuração padrão até ${lastHour}:00`);
    
    for (let h = 8; h <= lastHour; h += 1.5) {
        const hour = Math.floor(h);
        const minutes = (h - hour) * 60;
        list.push(`${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
    }
    
    console.log(`Horários gerados: [${list.join(', ')}]`);
    return list;
}

// Testar com as datas críticas
console.log("\n=== TESTE COM DATAS CRÍTICAS ===");

const criticalDates = [
    { date: "2026-05-11", expectedDay: 0, expectedName: "Domingo", expectedSlots: 0 },
    { date: "2026-05-12", expectedDay: 1, expectedName: "Segunda-feira", expectedSlots: 5 },
    { date: "2026-05-13", expectedDay: 2, expectedName: "Terça-feira", expectedSlots: 6 },
    { date: "2026-05-14", expectedDay: 3, expectedName: "Quarta-feira", expectedSlots: 6 },
    { date: "2026-05-15", expectedDay: 4, expectedName: "Quinta-feira", expectedSlots: 6 },
    { date: "2026-05-16", expectedDay: 5, expectedName: "Sexta-feira", expectedSlots: 6 },
    { date: "2026-05-17", expectedDay: 6, expectedName: "Sábado", expectedSlots: 8 },
];

let allCorrect = true;

criticalDates.forEach(({ date, expectedDay, expectedName, expectedSlots }) => {
    console.log(`\n--- TESTE: ${date} ---`);
    
    const [year, month, day] = date.split('-').map(Number);
    const testDate = new Date(year, month - 1, day);
    const actualDay = testDate.getDay();
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const actualName = dayNames[actualDay];
    
    const dayCorrect = actualDay === expectedDay && actualName === expectedName;
    
    console.log(`Esperado: ${expectedName} (${expectedDay}), Obtido: ${actualName} (${actualDay}) ${dayCorrect ? '✅' : '❌'}`);
    
    if (dayCorrect) {
        const slots = createHourSlotsFixed(date);
        const slotsCorrect = slots.length === expectedSlots;
        console.log(`Esperado: ${expectedSlots} horários, Obtido: ${slots.length} horários ${slotsCorrect ? '✅' : '❌'}`);
        
        if (!slotsCorrect) {
            allCorrect = false;
        }
    } else {
        allCorrect = false;
    }
});

console.log("\n=== RESULTADO FINAL ===");
console.log(`Correção ${allCorrect ? '✅ FUNCIONOU' : '❌ FALHOU'}`);

if (allCorrect) {
    console.log("\n🎉 O problema de deslocamento de dias foi resolvido!");
    console.log("Agora cada dia da semana mostrará os horários corretos:");
    console.log("- Domingos: Sem horários");
    console.log("- Segundas: 09:30, 11:00, 12:30, 14:00, 15:30");
    console.log("- Terça a Sexta: Configuração padrão 08:00-17:00");
    console.log("- Sábados: Configuração padrão 08:00-20:00");
} else {
    console.log("\n❌ A correção não resolveu completamente o problema.");
}
