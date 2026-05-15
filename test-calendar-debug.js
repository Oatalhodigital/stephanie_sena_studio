// Teste específico para debug do problema de calendário

console.log("=== TESTE ESPECÍFICO DO CALENDÁRIO ===");

// Simular exatamente como o sistema funciona
function simulateSystem() {
    // 1. Simular todayStr() - como o sistema define a data atual
    function todayStr() {
        const d = new Date();
        return d.toISOString().split("T")[0];
    }
    
    // 2. Simular createHourSlots() - função atual
    function createHourSlots(selectedDate) {
        const list = [];
        const date = new Date(selectedDate);
        const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda-feira, 6 = Sábado
        
        console.log(`\nANÁLISE PARA DATA: ${selectedDate}`);
        console.log(`new Date("${selectedDate}"):`, date);
        console.log(`getDay(): ${dayOfWeek} (${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek]})`);
        console.log(`toISOString(): ${date.toISOString()}`);
        console.log(`toLocaleString(): ${date.toLocaleString('pt-BR')}`);
        
        // DOMINGOS: Remover completamente a disponibilidade
        if (dayOfWeek === 0) {
            console.log("RESULTADO: DOMINGO - Sem horários disponíveis");
            return [];
        }
        
        // SEGUNDAS-FEIRAS: Horário fixo de 09:30 às 17:00
        if (dayOfWeek === 1) {
            console.log("RESULTADO: SEGUNDA-FEIRA - 09:30, 11:00, 12:30, 14:00, 15:30");
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
        console.log(`RESULTADO: ${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek]} - Configuração padrão até ${lastHour}:00`);
        
        for (let h = 8; h <= lastHour; h += 1.5) {
            const hour = Math.floor(h);
            const minutes = (h - hour) * 60;
            list.push(`${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
        }
        
        console.log(`Horários gerados: [${list.join(', ')}]`);
        return list;
    }
    
    // 3. Testar com datas específicas que poderiam causar problema
    const testDates = [
        "2026-05-11", // Domingo
        "2026-05-12", // Segunda-feira
        "2026-05-13", // Terça-feira
        "2026-05-14", // Quarta-feira
        "2026-05-15", // Quinta-feira
        "2026-05-16", // Sexta-feira
        "2026-05-17", // Sábado
    ];
    
    testDates.forEach(dateStr => {
        createHourSlots(dateStr);
    });
    
    // 4. Verificar problema específico de fuso horário
    console.log("\n=== VERIFICAÇÃO DE FUSO HORÁRIO ===");
    const problematicDate = "2026-05-12";
    
    console.log(`Testando data problemática: ${problematicDate}`);
    
    // Testar diferentes formas de criar a data
    const methods = [
        () => new Date(problematicDate),
        () => new Date(problematicDate + "T00:00:00"),
        () => new Date(problematicDate + "T12:00:00"),
        () => new Date(problematicDate + "T23:59:59"),
    ];
    
    methods.forEach((method, index) => {
        try {
            const date = method();
            console.log(`Método ${index + 1}: ${date} -> getDay(): ${date.getDay()}`);
        } catch (error) {
            console.log(`Método ${index + 1}: ERRO - ${error.message}`);
        }
    });
}

simulateSystem();
