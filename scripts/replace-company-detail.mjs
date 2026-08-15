import { readFileSync, writeFileSync } from 'node:fs';

const path = '/home/ubuntu/hub-trade-marketing/client/src/pages/CompaniesWorkspace.tsx';
const source = readFileSync(path, 'utf8');
const start = source.indexOf('  if (selectedProvider) {');
const end = source.indexOf('  if (selectedId) return', start);

if (start < 0 || end < 0) {
  throw new Error('Não foi possível localizar a ficha legada de Empresa.');
}

const replacement = `  if (selectedProvider) {
    const currentProvider = selectedProvider as Provider;
    const currentScope = providerScope(currentProvider);
    return <CompanyDetails provider={currentProvider} scope={currentScope} canWrite={canWrite} uploading={uploading} onBack={() => setLocation("/empresas")} onEdit={() => edit(currentProvider)} onInstitutionalUpload={(kind, file) => { void uploadInstitutional(currentProvider, kind, file); }} additionalDocument={additionalDocument} onAdditionalDocumentChange={setAdditionalDocument} onAddDocument={() => { void uploadAdditionalDocument(currentProvider); }} onRemoveDocument={documentId => { void removeAdditionalDocument(currentProvider.id, documentId); }} pending={updateProvider.isPending} editingProvider={editingProvider} onEditingChange={setEditingProvider} onSubmit={submitProvider} />;
  }
`;

writeFileSync(path, `${source.slice(0, start)}${replacement}${source.slice(end)}`);
