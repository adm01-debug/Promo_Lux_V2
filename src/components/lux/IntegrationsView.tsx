import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Webhook as WebhookIcon } from "lucide-react";
import { ApiKeysPanel } from "./integrations/ApiKeysPanel";
import { WebhooksPanel } from "./integrations/WebhooksPanel";
import { ApiDocsCard } from "./integrations/ApiDocsCard";

export function IntegrationsView() {
  const [tab, setTab] = useState("api-keys");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API & Webhooks</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Integre seus dados com sistemas externos via REST API ou eventos de webhook.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="api-keys" className="gap-1.5"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5"><WebhookIcon className="h-3.5 w-3.5" /> Webhooks</TabsTrigger>
          <TabsTrigger value="docs">Documentação</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="mt-4"><ApiKeysPanel /></TabsContent>
        <TabsContent value="webhooks" className="mt-4"><WebhooksPanel /></TabsContent>
        <TabsContent value="docs" className="mt-4"><ApiDocsCard /></TabsContent>
      </Tabs>
    </div>
  );
}