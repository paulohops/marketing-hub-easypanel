import { readFile, writeFile } from "node:fs/promises";

const path = "/home/ubuntu/hub-trade-marketing/client/src/pages/CompaniesWorkspace.tsx";
const source = await readFile(path, "utf8");
const replacements = new Map([
  ['<RelationList title="Regionais vinculadas" values={scope.regionals.map((item: any) => `${item.name} · ${item.code}`)} />', '<RelationList title="Regionais vinculadas" items={scope.regionals.map((item: any) => ({ id: item.id, label: `${item.name} · ${item.code}`, href: `/cadastros/regionais/${item.id}` }))} />'],
  ['<RelationList title="Cidades atendidas" values={scope.cities.map((item: any) => `${item.name} · ${item.state}`)} />', '<RelationList title="Cidades atendidas" items={scope.cities.map((item: any) => ({ id: item.id, label: `${item.name} · ${item.state}`, href: `/cadastros/cidades/${item.id}` }))} />'],
  ['<RelationList title="Lojas vinculadas" values={scope.stores.map((item: any) => item.name)} />', '<RelationList title="Lojas vinculadas" items={scope.stores.map((item: any) => ({ id: item.id, label: item.name, href: `/cadastros/lojas/${item.id}` }))} />'],
  ['<RelationList title="Fornecedores vinculados" values={scope.suppliers.map((item: any) => item.displayName)} />', '<RelationList title="Fornecedores vinculados" items={scope.suppliers.map((item: any) => ({ id: item.id, label: item.displayName, href: `/cadastros/fornecedores/${item.id}` }))} />'],
]);

let next = source;
for (const [from, to] of replacements) {
  if (!next.includes(from)) throw new Error(`Trecho não encontrado: ${from}`);
  next = next.replace(from, to);
}

await writeFile(path, next);
console.log("Vínculos navegáveis de Empresas aplicados.");
