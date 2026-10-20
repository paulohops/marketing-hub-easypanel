import fs from "fs";
import path from "path";
import { mcpTools } from "../server/mcp/tools";

const TARGET_DIRS = [
  path.resolve("C:/Users/OnNet Telecom/.gemini/antigravity/mcp/marketing-hub"),
  path.resolve("C:/Users/OnNet Telecom/Documents/Marketing HUB/antigravity-ide/mcp/marketing-hub"),
];

for (const targetDir of TARGET_DIRS) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`Created directory: ${targetDir}`);
  }

  for (const tool of mcpTools) {
    const schemaContent = {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    };

    const filePath = path.join(targetDir, `${tool.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(schemaContent, null, 2) + "\n", "utf-8");
    console.log(`Wrote: ${filePath}`);
  }

  // Update instructions.md
  const instructionsPath = path.join(targetDir, "instructions.md");
  const instructionsContent = `# Marketing HUB MCP Server
Conexão oficial com a API do Marketing HUB Trade Marketing.
Endpoint: http://10.159.245.28:8978/api/mcp

Ferramentas disponíveis:
${mcpTools.map(t => `- ${t.name}: ${t.description}`).join("\n")}
`;
  fs.writeFileSync(instructionsPath, instructionsContent, "utf-8");
  console.log(`Wrote: ${instructionsPath}`);
}

console.log("MCP schemas generation finished successfully!");
