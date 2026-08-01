/**
 * OpenAPI Specification for LUX IA Edge Functions
 * Version: 1.0.0
 */

export const LUX_OPENAPI_SPEC = {
  openapi: "3.0.0",
  info: {
    title: "LUX IA Edge Functions",
    description: "API de prospecção e inteligência de vendas LUX IA",
    version: "1.0.0"
  },
  paths: {
    "/gmaps-proxy": {
      get: {
        summary: "Lista jobs de raspagem",
        parameters: [
          { name: "action", in: "query", required: true, schema: { type: "string", enum: ["list"] } }
        ],
        responses: {
          200: { description: "Lista de jobs" }
        }
      },
      post: {
        summary: "Cria um novo job de raspagem",
        parameters: [
          { name: "action", in: "query", required: true, schema: { type: "string", enum: ["create"] } }
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateScrapeJob" }
            }
          }
        },
        responses: {
          200: { description: "Job criado" }
        }
      }
    },
    "/ai-agent": {
      post: {
        summary: "Interação com Agente IA",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  context: { type: "object" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Resposta da IA" }
        }
      }
    }
  },
  components: {
    schemas: {
      CreateScrapeJob: {
        type: "object",
        required: ["name", "config"],
        properties: {
          name: { type: "string" },
          auto_sync: { type: "boolean" },
          config: {
            type: "object",
            properties: {
              keywords: { type: "array", items: { type: "string" } },
              radius: { type: "number" }
            }
          }
        }
      }
    }
  }
};
