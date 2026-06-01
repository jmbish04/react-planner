import React, { useEffect, useState } from "react";
import { useAgent, useAgentChat } from "@cloudflare/ai-chat/react";
import { Thread } from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";

interface Props {
  sessionId: string;
}

export const FloorplanStudio: React.FC<Props> = ({ sessionId }) => {
  const [workspace, setWorkspace] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"viewport" | "history">("viewport");
  const [viewMode, setViewMode] = useState<string>("2d");
  const [lightingMode, setLightingMode] = useState<string>("day");

  const edgeAgentConnection = useAgent({
    agent: "floorplan-agent",
    name: sessionId,
    host: window.location.origin
  });

  const agentChatHarness = useAgentChat({ agent: edgeAgentConnection });
  const assistantRuntime = useAISDKRuntime(agentChatHarness);

  useEffect(() => {
    const syncWorkspacePayload = async () => {
      if (edgeAgentConnection.rpc?.getLatestWorkspaceState) {
        const rawState = await edgeAgentConnection.rpc.getLatestWorkspaceState();
        setWorkspace(rawState.layoutTree);
      }
    };
    syncWorkspacePayload();

    (window as any).setWorkspaceViewportMode = (view: string) => {
      console.log(`[Headless Driver] Toggling layout rendering matrix viewport to: ${view}`);
      setViewMode(view);
    };
    (window as any).applySpatialEnvironmentLighting = (mode: string) => {
      console.log(`[Headless Driver] Re-lighting simulation parameter configured to environment: ${mode}`);
      setLightingMode(mode);
    };
  }, [edgeAgentConnection]);

  return (
    <div className="flex h-screen w-full bg-zinc-950 font-sans text-zinc-50 antialiased overflow-hidden select-none">
      <div className="flex-1 h-full flex flex-col bg-zinc-900 relative">
        <div className="w-full h-12 bg-zinc-950/40 backdrop-blur border-b border-zinc-900/60 px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tracking-widest text-zinc-400 uppercase">Studio // Workspace</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </div>
          <div className="flex bg-zinc-900 p-0.5 rounded border border-zinc-800/40">
            <button
              onClick={() => setActiveTab("viewport")}
              className={`px-3 py-1 text-xs font-medium rounded transition-all duration-150 ${activeTab === "viewport" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Live Editor
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1 text-xs font-medium rounded transition-all duration-150 ${activeTab === "history" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              D1 Revision Ledger
            </button>
          </div>
        </div>

        <div className="flex-1 w-full relative flex items-center justify-center p-8 bg-[radial-gradient(#1e1e24_1px,transparent_1px)] [background-size:16px_16px]">
          {activeTab === "viewport" ? (
            <div className="flex flex-col items-center gap-4 text-center max-w-md">
              <div className="w-16 h-16 rounded border border-zinc-800 bg-zinc-950/40 flex items-center justify-center font-mono text-zinc-400 text-sm uppercase">
                {viewMode}
              </div>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed uppercase tracking-wider">
                {workspace ? `Active Layout State Synced // ${JSON.stringify(workspace).length} Bytes Serialized // Lighting: ${lightingMode}` : "Awaiting Remote State Synchronization Engine..."}
              </p>
            </div>
          ) : (
            <div className="w-full max-w-3xl h-full overflow-y-auto py-4 px-2 space-y-3">
              <div className="p-4 bg-zinc-950/40 rounded border border-zinc-900 flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="text-zinc-200 font-semibold uppercase">Revision #02 // L-Shape Kitchen Layout</div>
                  <div className="text-zinc-500 mt-1">Applied custom deepsteel finish and calibrated absolute clearances to 90cm.</div>
                </div>
                <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700/40 transition-colors uppercase tracking-wider text-[10px]">
                  Rollback
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-[380px] h-full bg-zinc-950 flex flex-col border-l border-zinc-900/60 shadow-[2px_0_24px_rgba(0,0,0,0.8)] z-20">
        <div className="p-4 h-12 flex items-center justify-between border-b border-zinc-900/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Colby Executive Architect</span>
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Thread runtime={assistantRuntime} />
        </div>
      </div>
    </div>
  );
};
