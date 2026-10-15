import { useRef, useState, type DragEvent } from "react";
import { Icon } from "../../components/ui/Icon";
import { MAX_UPLOAD_BYTES } from "../../lib/config";
import { formatBytes } from "../../lib/format";

interface FileDropProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPT = ".pdf,.docx,.txt,application/pdf,text/plain";

/** Optional study-material upload: PDF / DOCX / TXT, 10 MB each (limits and de-duplication as in the original). */
export function FileDrop({ files, onChange, disabled }: FileDropProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");

  const add = (incoming: FileList | File[]) => {
    const rejected: string[] = [];
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push(file.name);
        continue;
      }
      if (!next.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) next.push(file);
    }
    onChange(next);
    setError(
      rejected.length
        ? `Each upload must be 10 MB or smaller. Not added: ${rejected.join(", ")}. You can leave uploads empty and use the built-in textbooks.`
        : "",
    );
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (!disabled && event.dataTransfer.files.length) add(event.dataTransfer.files);
  };

  return (
    <div>
      <div
        className={`drop ${over ? "is-over" : ""} ${disabled ? "is-disabled" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Icon name="upload" size={26} />
        <p>
          <strong>Drop notes here</strong> or{" "}
          <button type="button" className="link-btn" disabled={disabled} onClick={() => input.current?.click()}>
            browse files
          </button>
        </p>
        <p className="muted">Optional · PDF, DOCX or TXT · 10 MB max per file</p>
        <input
          ref={input}
          id="src"
          className="sr-only"
          type="file"
          multiple
          accept={ACCEPT}
          disabled={disabled}
          aria-label="Upload study notes"
          onChange={(event) => {
            if (event.target.files) add(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {error ? (
        <p className="field__error" role="alert">
          <Icon name="alertCircle" size={15} /> <span>{error}</span>
        </p>
      ) : null}
      {files.length ? (
        <ul className="files" aria-live="polite">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              <Icon name="fileText" size={18} />
              <span className="files__name" title={file.name}>
                {file.name}
              </span>
              <span className="muted">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
