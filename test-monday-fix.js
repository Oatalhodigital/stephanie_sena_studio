// Teste específico para a segunda-feira

console.log("=== TESTE ESPECÍFICO SEGUNDA-FEIRA ===");

function testMondaySlots() {
    const selectedDate = "2026-05-12"; // Segunda-feira
    const list = [];
    
    // Simular exatamente como está no código
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    
    console.log(`Data: ${selectedDate}`);
    console.log(`getDay(): ${dayOfWeek} (${['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][dayOfWeek]})`);
    
    if (dayOfWeek === 1) {
        console.log("\nLoop para gerar horários:");
        // Loop atualizado
        for (let h = 9.5; h < 17; h += 1.5) {
            const hour = Math.floor(h);
            const minutes = (h - hour) * 60;
            const timeStr = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
            list.push(timeStr);
            console.log(`h=${h} -> ${timeStr}`);
        }
    }
    
    console.log(`\nTotal de horários gerados: ${list.length}`);
    console.log(`Horários: [${list.join(', ')}]`);
    
    return list;
}

const result = testMondaySlots();

console.log("\n=== VERIFICAÇÃO ===");
console.log("Esperado para segunda-feira: 09:30, 11:00, 12:30, 14:00, 15:30 (5 horários)");
console.log(`Obtido: [${result.join(', ')}] (${result.length} horários)`);
console.log(`Resultado: ${result.length === 5 ? '✅ CORRETO' : '❌ INCORRETO'}`);

if (result.length !== 5) {
    console.log("\n=== ANÁLISE DO PROBLEMA ===");
    console.log("O loop está gerando horários demais. Vamos analisar:");
    
    console.log("\nValores de h no loop:");
    let h = 9.5;
    let iteration = 0;
    while (h < 17 && iteration < 10) {
        console.log(`Iteração ${iteration}: h=${h}`);
        h += 1.5;
        iteration++;
    }
}
