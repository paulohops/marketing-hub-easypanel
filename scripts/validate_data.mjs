import fs from 'fs';
import { NEIGHBORHOODS_DATA } from './neighborhoods_data.mjs';

const cities = JSON.parse(fs.readFileSync('scripts/all_cities_list.json', 'utf8'));

let missing = [];
let totalBairros = 0;
for (const c of cities) {
  if (!NEIGHBORHOODS_DATA[c.id] || NEIGHBORHOODS_DATA[c.id].length === 0) {
    missing.push(c.id + ': ' + c.nome);
  } else {
    totalBairros += NEIGHBORHOODS_DATA[c.id].length;
  }
}

const extraIds = Object.keys(NEIGHBORHOODS_DATA).filter(id => !cities.some(c => c.id === Number(id)));

console.log('--- RELATÓRIO DE VALIDAÇÃO ---');
console.log('Total de cidades no sistema:', cities.length);
console.log('Total de cidades mapeadas:', Object.keys(NEIGHBORHOODS_DATA).length);
console.log('Cidades faltando:', missing.length === 0 ? 'NENHUMA! (100% OK)' : missing);
console.log('IDs extras desconhecidos:', extraIds.length === 0 ? 'NENHUM! (100% OK)' : extraIds);
console.log('Total de bairros levantados no mapeamento:', totalBairros);
console.log('Média de bairros por cidade:', (totalBairros / cities.length).toFixed(1));
