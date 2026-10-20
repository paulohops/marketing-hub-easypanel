import http from 'http';
import { NEIGHBORHOODS_DATA } from './neighborhoods_data.mjs';

const MCP_HOST = '10.159.245.28';
const MCP_PORT = 8978;
const MCP_TOKEN = 'mcp_hub_52b633bed5303e3a0cdba315854d935e4c54505c74a17847';
const CONCURRENCY = 12;

function callMcpTool(name, args) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now() + Math.random(),
    method: 'tools/call',
    params: {
      name,
      arguments: args
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: MCP_HOST,
      port: MCP_PORT,
      path: '/api/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MCP_TOKEN}`,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: data, status: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('====================================================');
  console.log('POVOAMENTO DE BAIRROS VIA MCP - MARKETING HUB');
  console.log(`Endpoint: http://${MCP_HOST}:${MCP_PORT}/api/mcp`);
  console.log('====================================================');

  const items = [];
  for (const [cityIdStr, names] of Object.entries(NEIGHBORHOODS_DATA)) {
    const cityId = Number(cityIdStr);
    for (const name of names) {
      items.push({ cityId, name });
    }
  }

  const total = items.length;
  console.log(`Total de bairros a processar: ${total} em ${Object.keys(NEIGHBORHOODS_DATA).length} cidades.\n`);

  let completed = 0;
  let created = 0;
  let alreadyExisted = 0;
  let errors = 0;
  const startTime = Date.now();

  async function worker(queue) {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      try {
        const res = await callMcpTool('cadastrar_bairro', { cityId: item.cityId, name: item.name });
        completed++;

        if (res.result && !res.error) {
          created++;
        } else if (res.error) {
          const msg = res.error.message || '';
          if (msg.includes('já está cadastrado') || msg.includes('unique')) {
            alreadyExisted++;
          } else {
            errors++;
            console.warn(`[ERRO] Cidade ${item.cityId} - Bairro "${item.name}":`, msg);
          }
        } else {
          created++;
        }
      } catch (err) {
        completed++;
        errors++;
        console.warn(`[FALHA DE REDE] Cidade ${item.cityId} - Bairro "${item.name}":`, err.message);
      }

      if (completed % 100 === 0 || completed === total) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (completed / elapsed).toFixed(1);
        console.log(`Progresso: ${completed}/${total} (${((completed / total) * 100).toFixed(1)}%) | Novos: ${created} | Já existiam: ${alreadyExisted} | Erros: ${errors} | ${elapsed}s (${rate} req/s)`);
      }
    }
  }

  const queue = [...items];
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(queue));
  }

  await Promise.all(workers);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n====================================================');
  console.log('RELATÓRIO FINAL DE POVOAMENTO VIA MCP');
  console.log('====================================================');
  console.log(`Tempo total: ${duration} segundos`);
  console.log(`Total processado: ${completed}`);
  console.log(`Novos cadastrados: ${created}`);
  console.log(`Já existiam no banco: ${alreadyExisted}`);
  console.log(`Erros: ${errors}`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
