import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";
import { Icon } from "./Icon";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** When false the dialog cannot be dismissed with Esc, the backdrop or the close button (use for required steps). */
  dismissible?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** Element id that should receive focus when the dialog opens. Defaults to the first focusable control. */
  initialFocusId?: string;
  className?: string;
}

/**
 * Accessible modal built on the native <dialog> element: focus is trapped by the browser,
 * Esc closes it, the page behind becomes inert, and focus returns to the opener on close.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = "md",
  initialFocusId,
  className = "",
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement;
      dialog.showModal();
      document.documentElement.classList.add("has-modal");
      if (initialFocusId) document.getElementById(initialFocusId)?.focus();
    }
    if (!open && dialog.open) dialog.close();
    return undefined;
  }, [open, initialFocusId]);

  useEffect(
    () => () => {
      document.documentElement.classList.remove("has-modal");
    },
    [],
  );

  const handleClose = () => {
    document.documentElement.classList.remove("has-modal");
    const opener = openerRef.current;
    if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    if (open) onClose();
  };

  const handleCancel = (event: SyntheticEvent) => {
    if (!dismissible) event.preventDefault();
  };

  const handleBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (dismissible && event.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size} ${className}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={handleClose}
      onCancel={handleCancel}
      onClick={handleBackdrop}
    >
      {open ? (
        <div className="dialog__panel">
          <header className="dialog__header">
            <div>
              <h2 id={titleId} className="dialog__title">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="dialog__desc">
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
                <Icon name="x" size={20} />
              </button>
            ) : null}
          </header>
          <div className="dialog__body">{children}</div>
          {footer ? <footer className="dialog__footer">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
