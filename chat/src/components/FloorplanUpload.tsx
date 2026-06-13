import { useRef, useState } from 'react';

export interface FloorLevel {
  label: string;
  dataUrl: string;
  mediaType: string;
  name: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Floorplan-image tracing panel. The user adds one image at a time with a level
 * label (e.g. "Lower Level"), queues several, then submits — all levels are sent
 * to the agent (Claude vision) in one multimodal message to trace + replicate,
 * one layer per level.
 */
export function FloorplanUpload({ onSubmit }: { onSubmit: (levels: FloorLevel[]) => void }) {
  const [levels, setLevels] = useState<FloorLevel[]>([]);
  const [label, setLabel] = useState('');
  const [pending, setPending] = useState<{ dataUrl: string; mediaType: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPending({ dataUrl, mediaType: file.type || 'image/png', name: file.name });
    if (!label) setLabel(file.name.replace(/\.[^.]+$/, ''));
  }

  function addLevel() {
    if (!pending || !label.trim()) return;
    setLevels((ls) => [...ls, { ...pending, label: label.trim() }]);
    setPending(null);
    setLabel('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeLevel(i: number) {
    setLevels((ls) => ls.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (levels.length === 0) return;
    onSubmit(levels);
    setLevels([]);
  }

  return (
    <div className="sa-upload">
      <p className="sa-upload-hint">Upload a floorplan image, label its level, and add it. Repeat for each level, then trace.</p>

      <div className="sa-upload-row">
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="sa-upload-file" />
      </div>
      {pending && (
        <div className="sa-upload-pending">
          <img src={pending.dataUrl} alt="preview" className="sa-upload-thumb" />
          <input
            className="sa-upload-label"
            placeholder="Level label (e.g. Lower Level)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLevel()}
          />
          <button className="sa-btn" onClick={addLevel} disabled={!label.trim()}>Add</button>
        </div>
      )}

      {levels.length > 0 && (
        <div className="sa-upload-queue">
          {levels.map((l, i) => (
            <div key={i} className="sa-upload-item">
              <img src={l.dataUrl} alt={l.label} className="sa-upload-thumb" />
              <span className="sa-upload-itemlabel">{i + 1}. {l.label}</span>
              <button className="sa-btn sa-btn--ghost" onClick={() => removeLevel(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <button className="sa-send sa-upload-submit" onClick={submit} disabled={levels.length === 0}>
        Trace &amp; replicate {levels.length || ''} level{levels.length === 1 ? '' : 's'}
      </button>
    </div>
  );
}
