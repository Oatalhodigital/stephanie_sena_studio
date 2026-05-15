// Teste para verificar se a correção do fuso horário resolveu o problema

console.log("=== TESTE DE VERIFICAÇÃO DA CORREÇÃO ===");

// Função corrigida
function createHourSlotsFixed(selectedDate) {
    const list = [];
    // CORREÇÃO: Garantir que a data seja interpretada como horário local, não UTC
    const date = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda-feira, 6 = Sábado
    
    console.log(`\nData: ${selectedDate}`);
    console.log(`new Date("${selectedDate}T00:00:00"): ${date}`);
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

// Testar com as datas problemáticas
console.log("\n=== TESTANDO COM DATAS ESPECÍFICAS ===");

const testDates = [
    { date: "2026-05-11", expected: "Domingo" },
    { date: "2026-05-12", expected: "Segunda-feira" },
    { date: "2026-05-13", expected: "Terça-feira" },
    { date: "2026-05-14", expected: "Quarta-feira" },
    { date: "2026-05-15", expected: "Quinta-feira" },
    { date: "2026-05-16", expected: "Sexta-feira" },
    { date: "2026-05-17", expected: "Sábado" },
];

testDates.forEach(({ date, expected }) => {
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const testDate = new Date(date + 'T00:00:00');
    const actualDay = dayNames[testDate.getDay()];
    
    const isCorrect = actualDay === expected;
    console.log(`${date}: ${isCorrect ? '✅' : '❌'} Esperado: ${expected}, Obtido: ${actualDay}`);
    
    if (isCorrect) {
        createHourSlotsFixed(date);
    }
});

console.log("\n=== RESUMO ===");
console.log("A correção deve garantir que:");
console.log("1. Domingos (2026-05-11) não tenham horários");
console.log("2. Segundas (2026-05-12) tenham horários 09:30-17:00");
console.log("3. Terças (2026-05-13) tenham configuração padrão");
console.log("4. Não haja mais deslocamento de dias");
