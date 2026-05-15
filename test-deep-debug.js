// Debug profundo para entender o problema real

console.log("=== DEBUG PROFUNDO DO PROBLEMA ===");

// Verificar o que está acontecendo com datas futuras
console.log("\n1. VERIFICANDO DATA ATUAL DO SISTEMA:");
const now = new Date();
console.log("Data/hora atual:", now);
console.log("Ano:", now.getFullYear());
console.log("Mês:", now.getMonth() + 1); // JS é 0-indexado
console.log("Dia:", now.getDate());
console.log("Dia da semana:", now.getDay());

// Testar com data real (próxima segunda-feira)
console.log("\n2. TESTANDO COM PRÓXIMA SEGUNDA-FEIRA REAL:");
const nextMonday = new Date();
nextMonday.setDate(now.getDate() + ((7 - now.getDay() + 1) % 7 || 7)); // Próxima segunda
console.log("Próxima segunda-feira:", nextMonday);
console.log("getDay():", nextMonday.getDay());
console.log("toISOString():", nextMonday.toISOString().split('T')[0]);

// Testar diferentes formas de criar a mesma data
console.log("\n3. COMPARANDO MÉTODOS DE CRIAÇÃO DE DATA:");
const testDate = "2026-05-12";

const methods = {
    "String simples": () => new Date(testDate),
    "String com T00:00:00": () => new Date(testDate + "T00:00:00"),
    "String com T12:00:00": () => new Date(testDate + "T12:00:00"),
    "Parsing explícito": () => {
        const [y, m, d] = testDate.split('-').map(Number);
        return new Date(y, m - 1, d);
    },
    "UTC": () => {
        const [y, m, d] = testDate.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d));
    }
};

Object.entries(methods).forEach(([name, method]) => {
    try {
        const date = method();
        console.log(`${name}: ${date} -> getDay(): ${date.getDay()} -> ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][date.getDay()]}`);
    } catch (error) {
        console.log(`${name}: ERRO - ${error.message}`);
    }
});

// Verificar se o problema está no calendário HTML
console.log("\n4. SIMULANDO INPUT HTML:");
const input = document.createElement('input');
input.type = 'date';
input.value = '2026-05-12';
console.log("Input value:", input.value);
console.log("Input valueAsDate:", input.valueAsDate);
console.log("Input valueAsDate getDay():", input.valueAsDate?.getDay());

// Testar com ano válido (2024)
console.log("\n5. TESTANDO COM ANO VÁLIDO (2024):");
const validDate = "2024-05-13"; // Segunda-feira de maio de 2024

const validMethods = {
    "String simples": () => new Date(validDate),
    "Parsing explícito": () => {
        const [y, m, d] = validDate.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
};

Object.entries(validMethods).forEach(([name, method]) => {
    const date = method();
    console.log(`${name}: ${date} -> getDay(): ${date.getDay()} -> ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][date.getDay()]}`);
});

console.log("\n=== CONCLUSÃO ===");
console.log("Se o parsing explícito funcionar para 2024 mas não para 2026,");
console.log("o problema pode estar relacionado a como o JavaScript lida datas futuras inválidas.");
