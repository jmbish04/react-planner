import { useEffect, useRef, useState } from 'react';
import { useAgent } from 'agents/react';
import { useAgentChat } from '@cloudflare/ai-chat/react';
import {
  AssistantRuntimeProvider,
  AssistantModalPrimitive,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
} from '@assistant-ui/react';
import { useAISDKRuntime } from '@assistant-ui/react-ai-sdk';
import { onPlannerReady, applyScene, subscribeSceneChange, type Scene } from './planner';
import { DebugPanel } from './components/DebugPanel';
import { FloorplanUpload, type FloorLevel } from './components/FloorplanUpload';
import { pushLog } from './debug-log';

interface BlueprintState {
  scene: Scene;
  projectId: string;
  currentVersionId: string | null;
}

interface VersionMeta {
  id: string;
  label: string;
  parentVersionId: string | null;
  createdAt: number;
}

export default function App() {
  const [plannerReady, setPlannerReady] = useState(false);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastSceneJSON = useRef<string>('');

  const agent = useAgent<BlueprintState>({
    agent: 'blueprint-agent',
    name: 'default',
    onStateUpdate: (state) => {
      if (!state?.scene) return;
      const json = JSON.stringify(state.scene);
      if (json === lastSceneJSON.current) return;
      lastSceneJSON.current = json;
      const layer = Object.values(state.scene.layers || {})[0] as any;
      pushLog('info', 'agent', `scene update applied to canvas (${layer ? Object.keys(layer.lines || {}).length : 0} walls)`);
      applyScene(state.scene); // agent edited the blueprint -> paint the canvas
    },
    onError: (e: unknown) => pushLog('error', 'agent', e instanceof Error ? e.message : String(e)),
  });

  // Cloudflare agent chat (WebSocket transport) adapted into an assistant-ui runtime.
  const chat = useAgentChat({ agent });
  const runtime = useAISDKRuntime(chat as never);

  useEffect(() => onPlannerReady(() => setPlannerReady(true)), []);

  // Push manual canvas edits up to the agent's canonical state.
  useEffect(() => {
    if (!plannerReady) return;
    return subscribeSceneChange((scene) => {
      const json = JSON.stringify(scene);
      if (json === lastSceneJSON.current) return;
      lastSceneJSON.current = json;
      agent.stub.syncScene(scene).catch(() => {});
    });
  }, [plannerReady, agent]);

  async function refreshVersions() {
    try {
      const list = (await agent.stub.getVersions()) as VersionMeta[];
      setVersions(list ?? []);
    } catch { /* agent not ready yet */ }
  }

  async function onSave() {
    setSaving(true);
    try {
      await agent.stub.saveCurrentVersion(`Draft ${new Date().toLocaleString()}`);
      await refreshVersions();
    } finally {
      setSaving(false);
    }
  }

  async function onRestore(id: string) {
    await agent.stub.restore(id);
    setShowHistory(false);
  }

  // Send the queued floorplan level images to the agent (Claude vision) as one
  // multimodal message to trace + replicate, one layer per level.
  function onTraceFloorplans(levels: FloorLevel[]) {
    const list = levels.map((l, i) => `${i + 1}. "${l.label}"`).join(', ');
    const text =
      `I'm uploading ${levels.length} floorplan image(s), one per building level, in this order: ${list}. ` +
      `Trace each image and replicate its exterior + interior walls, doors, and windows on the canvas. ` +
      `Put each level on its own layer (rename the active layer for the first level; create_layer for each subsequent level). ` +
      `Infer scale from any printed dimensions; otherwise choose a sensible scale so it fits the canvas. ` +
      `When done, summarize what you traced and ask me to confirm the scale.`;
    const parts: any[] = [{ type: 'text', text }];
    for (const l of levels) parts.push({ type: 'file', mediaType: l.mediaType, url: l.dataUrl, filename: l.name });
    pushLog('info', 'trace', `Submitting ${levels.length} floorplan level(s) to the agent: ${list}`);
    (chat as any).sendMessage({ role: 'user', parts });
    setShowUpload(false);
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantModalPrimitive.Root>
        <AssistantModalPrimitive.Anchor className="sa-fab-anchor">
          <AssistantModalPrimitive.Trigger className="sa-fab" aria-label="Open Smart Architect">
            <span className="sa-fab-icon">◳</span>
          </AssistantModalPrimitive.Trigger>
        </AssistantModalPrimitive.Anchor>

        <AssistantModalPrimitive.Content
          className="sa-sidebar sa-modal"
          side="top"
          align="end"
          sideOffset={14}
          onInteractOutside={(e: Event) => e.preventDefault()}
        >
        <header className="sa-header">
          <div className="sa-title">
            <span className="sa-logo">◳</span>
            <div>
              <h1>Smart Architect</h1>
              <p className="sa-status">{plannerReady ? 'Connected to canvas' : 'Connecting…'}</p>
            </div>
          </div>
          <div className="sa-actions">
            <button className="sa-btn" onClick={onSave} disabled={saving} title="Save current blueprint as a version">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              className="sa-btn"
              onClick={() => { setShowHistory((v) => !v); if (!showHistory) refreshVersions(); }}
              title="Version history"
            >History</button>
            <button
              className="sa-btn"
              onClick={() => setShowUpload((v) => !v)}
              title="Trace a floorplan image"
            >Trace</button>
            <a className="sa-btn sa-btn--ghost" href="/docs/" target="_blank" rel="noreferrer" title="Technical documentation">Docs</a>
          </div>
        </header>

        {showUpload && <FloorplanUpload onSubmit={onTraceFloorplans} />}

        {showHistory && (
          <div className="sa-history">
            {versions.length === 0 && <p className="sa-empty">No saved versions yet.</p>}
            {versions.map((v) => (
              <div key={v.id} className="sa-version">
                <div className="sa-version-meta">
                  <span className="sa-version-label">{v.label}</span>
                  <span className="sa-version-time">{new Date(v.createdAt).toLocaleString()}</span>
                </div>
                <button className="sa-btn sa-btn--ghost" onClick={() => onRestore(v.id)}>Restore</button>
              </div>
            ))}
          </div>
        )}

        <ThreadPrimitive.Root className="sa-thread">
          <ThreadPrimitive.Viewport className="sa-messages">
            <ThreadPrimitive.Empty>
              <div className="sa-welcome">
                <p>Hi — I'm your architect. Describe the home and I'll draw it on the canvas.</p>
                <div className="sa-suggestions">
                  <Suggestion text="Start with a 1000 x 800 cm exterior as a single rectangle." />
                  <Suggestion text="Add an interior wall splitting off a 300 cm kitchen on the left." />
                  <Suggestion text="Put a front door on the south wall and a window beside it." />
                  <Suggestion text="Place a sofa and a tv in the living room." />
                </div>
              </div>
            </ThreadPrimitive.Empty>

            <ThreadPrimitive.Messages
              components={{ UserMessage, AssistantMessage }}
            />
          </ThreadPrimitive.Viewport>

          <ComposerPrimitive.Root className="sa-input">
            <ComposerPrimitive.Input
              className="sa-input-field"
              placeholder="Describe a change to the floorplan…"
              autoFocus
            />
            <ComposerPrimitive.Send className="sa-send">Send</ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>

        <DebugPanel />
        </AssistantModalPrimitive.Content>
      </AssistantModalPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function Suggestion({ text }: { text: string }) {
  return (
    <ThreadPrimitive.Suggestion className="sa-suggestion" prompt={text} method="replace" autoSend>
      {text}
    </ThreadPrimitive.Suggestion>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="sa-msg sa-msg--user">
      <MessagePrimitive.Parts />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="sa-msg sa-msg--assistant">
      <MessagePrimitive.Parts components={{ tools: { Fallback: ToolFallback } }} />
    </MessagePrimitive.Root>
  );
}

function ToolFallback({ toolName, status }: { toolName: string; status?: { type?: string } }) {
  const done = status?.type === 'complete';
  return (
    <span className="sa-tool">
      <span className="sa-tool-dot" data-done={done} /> {toolName}
    </span>
  );
}
