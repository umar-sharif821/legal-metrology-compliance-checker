/**
 * Upload / capture.
 *
 * The staged progress is not theatre — it names the four stages the pipeline actually
 * has (admit the frame, read text, extract declarations, evaluate the rule pack), in
 * order, so a person watching learns what the tool does. The durations are indicative
 * and the screen says so; this app has no measured latency to quote (P8).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardHead, Note, useToast } from '../components/ui';
import {
  IconAlert,
  IconCamera,
  IconCheck,
  IconClose,
  IconScan,
  IconSpinner,
  IconUpload,
} from '../components/icons';
import { analyseImage } from '../lib/api';
import { useScans } from '../lib/store';
import { FRAME_ADMISSION, PACK } from '../lib/rulepack';

const STAGES = [
  { id: 'admit', label: 'Admitting the frame', detail: 'Print size, panel coverage, cropping' },
  { id: 'ocr', label: 'Reading text', detail: 'On-device text recognition' },
  { id: 'extract', label: 'Extracting declarations', detail: 'Anchors, then geometry' },
  {
    id: 'evaluate',
    label: 'Evaluating the rule pack',
    detail: 'Deterministic — no learned parameters',
  },
] as const;

const MAX_BYTES = 12 * 1024 * 1024;

export function ScanPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { addScan } = useScans();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const accept = useCallback(
    (f: File | null) => {
      setError(null);
      if (!f) return;
      if (!f.type.startsWith('image/')) {
        setError('That file is not an image. Upload a photograph of the declaration panel.');
        return;
      }
      if (f.size > MAX_BYTES) {
        setError('That image is larger than 12 MB. Use a smaller capture.');
        return;
      }
      if (preview) URL.revokeObjectURL(preview);
      setFile(f);
      setPreview(URL.createObjectURL(f));
    },
    [preview],
  );

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } },
      });
      streamRef.current = stream;
      setCamera(true);
      // The element mounts with `camera`, so attach on the next frame.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError(
        'No camera available in this browser, or permission was refused. Upload an image instead.',
      );
    }
  }, []);

  const shoot = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        accept(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        stopCamera();
      },
      'image/jpeg',
      0.92,
    );
  }, [accept, stopCamera]);

  const analyse = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStage(0);

    const timers = [
      setTimeout(() => setStage(1), 420),
      setTimeout(() => setStage(2), 1150),
      setTimeout(() => setStage(3), 1750),
    ];

    try {
      const { data, origin } = await analyseImage(file);
      addScan(data);
      toast(
        origin === 'live'
          ? { tone: 'clear', title: 'Analysis complete', body: `Report ${data.id} is ready.` }
          : {
              tone: 'unknown',
              title: 'No backend answered',
              body: 'Showing a record from the bundled sample corpus, not a reading of your image.',
            },
      );
      navigate(`/scans/${data.id}`);
    } catch {
      setError('The analysis could not be completed. Try again, or re-capture the panel.');
      toast({ tone: 'violation', title: 'Analysis failed', body: 'Nothing was recorded.' });
    } finally {
      timers.forEach(clearTimeout);
      setBusy(false);
      setStage(-1);
    }
  }, [file, addScan, navigate, toast]);

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Card className="animate-rise self-start">
        <CardHead
          title="Capture the declaration panel"
          hint="The rear or side panel carrying the mandatory declarations — not the front of the pack"
        />

        <div className="p-5">
          {camera ? (
            <div className="overflow-hidden rounded-xl border border-line-200 bg-navy-950">
              <div className="relative">
                <video ref={videoRef} playsInline muted className="block w-full" />
                {/* Framing guide — the panel should fill it */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  <div className="h-[72%] w-[86%] rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(6,21,42,0.35)]" />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11.5px] text-white/85">
                  Fill the guide with the declaration panel
                </div>
              </div>
              <div className="flex gap-2 p-3">
                <Button onClick={shoot} className="flex-1">
                  <IconCamera width={16} height={16} />
                  Capture frame
                </Button>
                <Button variant="secondary" onClick={stopCamera}>
                  <IconClose width={15} height={15} />
                  Cancel
                </Button>
              </div>
            </div>
          ) : preview ? (
            <div className="overflow-hidden rounded-xl border border-line-200">
              <img
                src={preview}
                alt="Selected label"
                className="block max-h-[380px] w-full object-contain bg-canvas"
              />
              <div className="flex items-center gap-2 border-t border-line-200 p-3">
                <p className="min-w-0 flex-1 truncate text-[12px] text-ink-500">
                  {file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  disabled={busy}
                >
                  <IconClose width={14} height={14} />
                  Replace
                </Button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                accept(e.dataTransfer.files[0] ?? null);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                dragging
                  ? 'border-navy-600 bg-navy-600/5'
                  : 'border-line-300 hover:border-navy-500 hover:bg-canvas'
              }`}
            >
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-canvas text-navy-600 ring-1 ring-line-200">
                <IconUpload width={20} height={20} />
              </div>
              <p className="text-[13.5px] font-semibold text-ink-900">
                Drop a label image, or click to browse
              </p>
              <p className="mt-1 text-[12px] text-ink-500">JPEG or PNG, up to 12 MB</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    void startCamera();
                  }}
                >
                  <IconCamera width={15} height={15} />
                  Use camera
                </Button>
              </div>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => accept(e.target.files?.[0] ?? null)}
          />

          {error && (
            <Note
              tone="violation"
              icon={<IconAlert width={15} height={15} className="mt-px shrink-0" />}
              className="mt-4"
            >
              {error}
            </Note>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button
              size="lg"
              onClick={() => void analyse()}
              disabled={!file || busy}
              className="flex-1"
            >
              {busy ? (
                <>
                  <IconSpinner width={17} height={17} />
                  Analysing…
                </>
              ) : (
                <>
                  <IconScan width={17} height={17} />
                  Analyse label
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="animate-rise">
          <CardHead title="Pipeline" hint="What runs, in order, once you press analyse" />
          <ol className="flex flex-col p-2">
            {STAGES.map((s, i) => {
              const state = !busy ? 'idle' : i < stage ? 'done' : i === stage ? 'active' : 'idle';
              return (
                <li
                  key={s.id}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    state === 'active' ? 'bg-navy-600/5' : ''
                  }`}
                >
                  <span
                    className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      state === 'done'
                        ? 'bg-clear-mark text-white'
                        : state === 'active'
                          ? 'bg-navy-600 text-white'
                          : 'bg-canvas text-ink-400 ring-1 ring-line-200'
                    }`}
                  >
                    {state === 'done' ? (
                      <IconCheck width={11} height={11} strokeWidth={3} />
                    ) : state === 'active' ? (
                      <IconSpinner width={11} height={11} strokeWidth={3} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-[12.5px] font-medium ${
                        state === 'idle' ? 'text-ink-500' : 'text-ink-900'
                      }`}
                    >
                      {s.label}
                    </p>
                    <p className="text-[11px] text-ink-400">{s.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {busy && (
            <div className="relative h-0.5 overflow-hidden bg-line-200">
              <div
                className="absolute inset-y-0 w-1/3 bg-navy-600"
                style={{ animation: 'sweep 1.4s ease-in-out infinite alternate' }}
              />
            </div>
          )}
        </Card>

        <Card className="animate-rise">
          <CardHead title="What the capture is checked for" />
          <ul className="flex flex-col gap-2.5 p-5 text-[12.5px] text-ink-700">
            <li className="flex justify-between gap-3">
              <span>Print size, as a fraction of frame height</span>
              <span className="tnum shrink-0 font-mono text-[11.5px] text-ink-500">
                ≥ {(FRAME_ADMISSION.minTextHeightFraction * 100).toFixed(1)}%
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Panel coverage, as a fraction of frame area</span>
              <span className="tnum shrink-0 font-mono text-[11.5px] text-ink-500">
                ≥ {(FRAME_ADMISSION.minTextCoverage * 100).toFixed(1)}%
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Text flush against the frame border</span>
              <span className="tnum shrink-0 font-mono text-[11.5px] text-ink-500">
                ≤ {(FRAME_ADMISSION.maxEdgeTouchFraction * 100).toFixed(0)}%
              </span>
            </li>
          </ul>
          <div className="px-5 pb-5">
            <Note
              tone="advisory"
              icon={<IconAlert width={15} height={15} className="mt-px shrink-0" />}
            >
              <b className="font-semibold">
                Sharpness is not checked — {FRAME_ADMISSION.unscored.join(' and ')} are unmeasured.
              </b>{' '}
              Both need raw pixel access this build does not have. A capture can pass every check
              above and still be too blurry to trust. This is stated rather than hidden, and no
              number is produced for it.
            </Note>
          </div>
        </Card>

        <Note tone="unknown">{PACK.scopeNote}</Note>
      </div>
    </div>
  );
}
