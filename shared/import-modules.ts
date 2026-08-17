export type ImportColumn = {
  key: string;
  label: string;
  required?: boolean;
};

export const IMPORT_MODULES = [
  {
    id: "providers",
    label: "Empresas",
    description: "Empresas e fornecedores principais da operação.",
    sheetName: "Empresas",
    columns: [
      { key: "name", label: "Nome", required: true },
      { key: "legalName", label: "Razão social" },
      { key: "billingCnpj", label: "CNPJ de faturamento" },
      { key: "contactName", label: "Nome do contato" },
      { key: "phone", label: "Telefone" },
      { key: "email", label: "E-mail" },
      { key: "address", label: "Endereço" },
    ],
  },
  {
    id: "regionals",
    label: "Regionais",
    description: "Regionais responsáveis pela organização territorial.",
    sheetName: "Regionais",
    columns: [
      { key: "providerName", label: "Empresa" },
      { key: "name", label: "Nome", required: true },
      { key: "code", label: "Código", required: true },
    ],
  },
  {
    id: "cities",
    label: "Cidades",
    description: "Cidades vinculadas a uma Regional e a uma UF.",
    sheetName: "Cidades",
    columns: [
      { key: "regionalCode", label: "Código da Regional", required: true },
      { key: "name", label: "Nome", required: true },
      { key: "state", label: "UF", required: true },
      { key: "ibgeCode", label: "Código IBGE" },
      { key: "address", label: "Endereço" },
      { key: "zipCode", label: "CEP" },
      { key: "latitude", label: "Latitude" },
      { key: "longitude", label: "Longitude" },
      { key: "locationNotes", label: "Observações de localização" },
    ],
  },
  {
    id: "stores",
    label: "Lojas",
    description: "Lojas e pontos de operação vinculados às cidades.",
    sheetName: "Lojas",
    columns: [
      { key: "regionalCode", label: "Código da Regional", required: true },
      { key: "cityName", label: "Cidade", required: true },
      { key: "name", label: "Nome", required: true },
      { key: "code", label: "Código", required: true },
      { key: "address", label: "Endereço" },
      { key: "referencePoint", label: "Ponto de referência" },
      { key: "zipCode", label: "CEP" },
      { key: "phone", label: "Telefone" },
      { key: "email", label: "E-mail" },
      { key: "openingHours", label: "Horário de funcionamento" },
      { key: "latitude", label: "Latitude" },
      { key: "longitude", label: "Longitude" },
    ],
  },
  {
    id: "partners",
    label: "Parceiros",
    description: "Parceiros comerciais e seus dados de relacionamento.",
    sheetName: "Parceiros",
    columns: [
      { key: "cityName", label: "Cidade" },
      { key: "name", label: "Nome", required: true },
      { key: "legalName", label: "Razão social" },
      { key: "document", label: "Documento" },
      { key: "contactName", label: "Nome do contato" },
      { key: "phone", label: "Telefone" },
      { key: "email", label: "E-mail" },
      { key: "partnershipType", label: "Tipo de parceria" },
      { key: "paymentMethod", label: "Forma de pagamento" },
      { key: "paymentRecurrence", label: "Recorrência de pagamento" },
      { key: "hasContract", label: "Possui contrato" },
    ],
  },
  {
    id: "suppliers",
    label: "Fornecedores",
    description: "Fornecedores e seus dados cadastrais e contratuais.",
    sheetName: "Fornecedores",
    columns: [
      { key: "providerName", label: "Empresa" },
      { key: "cityName", label: "Cidade" },
      { key: "displayName", label: "Nome de exibição", required: true },
      { key: "address", label: "Endereço" },
      { key: "legalName", label: "Razão social" },
      { key: "document", label: "Documento" },
      { key: "contactName", label: "Nome do contato" },
      { key: "phone", label: "Telefone" },
      { key: "email", label: "E-mail" },
      { key: "mainService", label: "Serviço principal" },
      { key: "partnershipType", label: "Tipo de parceria" },
      { key: "paymentMethod", label: "Forma de pagamento" },
      { key: "paymentRecurrence", label: "Recorrência de pagamento" },
      { key: "pixKey", label: "Chave Pix" },
      { key: "paymentDay", label: "Dia de pagamento" },
      { key: "paymentBarterValue", label: "Valor de permuta" },
      { key: "paymentBarterService", label: "Serviço de permuta" },
      { key: "paymentNotes", label: "Observações de pagamento" },
      { key: "contractStartsOn", label: "Início do contrato" },
      { key: "contractEndsOn", label: "Fim do contrato" },
      { key: "hasContract", label: "Possui contrato" },
    ],
  },
  {
    id: "mediaTypes",
    label: "Tipos de mídia",
    description: "Tipos de mídia usados nos cadastros de trade.",
    sheetName: "Tipos de mídia",
    columns: [
      { key: "name", label: "Nome", required: true },
      { key: "operationCategory", label: "Categoria de mídia" },
      { key: "parentMediaTypeName", label: "Tipo de mídia pai" },
    ],
  },
  {
    id: "serviceTypes",
    label: "Tipos de serviço",
    description: "Tipos de serviço e suas relações com mídia.",
    sheetName: "Tipos de serviço",
    columns: [
      { key: "name", label: "Nome", required: true },
      { key: "mediaTypeName", label: "Tipo de mídia" },
      { key: "parentServiceTypeName", label: "Tipo de serviço pai" },
    ],
  },
  {
    id: "productTypes",
    label: "Tipos de produto",
    description: "Categorias de produtos usados na operação.",
    sheetName: "Tipos de produto",
    columns: [
      { key: "name", label: "Nome", required: true },
      { key: "description", label: "Descrição" },
    ],
  },
  {
    id: "actionTypes",
    label: "Tipos de ação",
    description: "Tipos de ação disponíveis no planejamento.",
    sheetName: "Tipos de ação",
    columns: [{ key: "name", label: "Nome", required: true }],
  },
  {
    id: "eventTypes",
    label: "Tipos de evento",
    description: "Tipos de evento disponíveis no planejamento.",
    sheetName: "Tipos de evento",
    columns: [{ key: "name", label: "Nome", required: true }],
  },
  {
    id: "campaignTypes",
    label: "Tipos de campanha",
    description: "Tipos de campanha disponíveis no planejamento.",
    sheetName: "Tipos de campanha",
    columns: [{ key: "name", label: "Nome", required: true }],
  },
  {
    id: "campaignSectors",
    label: "Setores de campanha",
    description: "Setores usados para classificar campanhas.",
    sheetName: "Setores de campanha",
    columns: [{ key: "name", label: "Nome", required: true }],
  },
  {
    id: "financialCategories",
    label: "Categorias financeiras",
    description: "Categorias utilizadas na classificação financeira.",
    sheetName: "Categorias financeiras",
    columns: [
      { key: "name", label: "Nome", required: true },
      { key: "description", label: "Descrição" },
    ],
  },
  {
    id: "supplierOfferings",
    label: "Ofertas de fornecedores",
    description: "Produtos, serviços e mídias oferecidos por fornecedores.",
    sheetName: "Ofertas de fornecedores",
    columns: [
      { key: "supplierName", label: "Fornecedor", required: true },
      { key: "kind", label: "Categoria da oferta", required: true },
      { key: "name", label: "Nome", required: true },
      { key: "mediaTypeName", label: "Tipo de mídia" },
      { key: "serviceTypeName", label: "Tipo de serviço" },
      { key: "productTypeName", label: "Tipo de produto" },
      { key: "unit", label: "Unidade" },
      { key: "unitPrice", label: "Preço unitário", required: true },
      { key: "averageUnitPrice", label: "Preço médio unitário" },
      { key: "notes", label: "Observações" },
    ],
  },
  {
    id: "commercialSupervisors",
    label: "Supervisores comerciais",
    description: "Supervisores comerciais e seus contatos.",
    sheetName: "Supervisores comerciais",
    columns: [
      { key: "name", label: "Nome", required: true },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
    ],
  },
  {
    id: "actionPoints",
    label: "Pontos de ação",
    description: "Pontos físicos vinculados às cidades.",
    sheetName: "Pontos de ação",
    columns: [
      { key: "cityName", label: "Cidade", required: true },
      { key: "name", label: "Nome", required: true },
      { key: "address", label: "Endereço" },
      { key: "latitude", label: "Latitude" },
      { key: "longitude", label: "Longitude" },
      { key: "notes", label: "Observações" },
    ],
  },
] as const satisfies readonly { id: string; label: string; description: string; sheetName: string; columns: readonly ImportColumn[] }[];

export type ImportModuleId = (typeof IMPORT_MODULES)[number]["id"];
export type ImportModuleDefinition = (typeof IMPORT_MODULES)[number];

export function getImportModuleDefinition(moduleId: string) {
  return IMPORT_MODULES.find(module => module.id === moduleId);
}

export function normalizeImportHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}
