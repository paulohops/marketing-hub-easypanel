import fs from 'fs';

const data = JSON.parse(fs.readFileSync('C:/Users/OnNet Telecom/.gemini/antigravity/brain/800a381a-e326-4ba6-89a0-ae5efb3e9031/.system_generated/steps/58/output.txt', 'utf8'));

console.log('Regionais:', data.regionais.length);
console.log('Cidades:', data.cidades.length);

const regMap = {};
for (const r of data.regionais) {
  regMap[r.id] = { nome: r.nome, codigo: r.codigo, cidades: [] };
}
for (const c of data.cidades) {
  if (regMap[c.regionalId]) {
    regMap[c.regionalId].cidades.push(c);
  } else {
    console.warn(`Cidade ${c.nome} com regional desconhecida: ${c.regionalId}`);
  }
}

for (const [id, reg] of Object.entries(regMap)) {
  console.log(`Regional ${id} - ${reg.nome} (${reg.codigo}): ${reg.cidades.length} cidades`);
  console.log('  Exemplos:', reg.cidades.slice(0, 5).map(c => `${c.id}:${c.nome}`).join(', '));
}

// Dump all 135 cities sorted by ID
const sortedCities = [...data.cidades].sort((a, b) => a.id - b.id);
fs.writeFileSync('scripts/all_cities_list.json', JSON.stringify(sortedCities, null, 2));
console.log('Saved all_cities_list.json');
