import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./Icon";

interface FieldShellProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  required?: boolean;
  className?: string;
}

interface ShellRenderProps {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

/** Shared label + hint + error wrapper. Error text is announced (role="alert") and linked via aria-describedby. */
function FieldShell({
  label,
  hint,
  error,
  optional,
  required,
  className,
  render,
  idOverride,
}: FieldShellProps & { render: (props: ShellRenderProps) => ReactNode; idOverride?: string }) {
  const autoId = useId();
  const id = idOverride ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field ${error ? "has-error" : ""} ${className ?? ""}`.trim()}>
      <label className="field__label" htmlFor={id}>
        <span>{label}</span>
        {optional ? <span className="field__tag">Optional</span> : null}
        {required ? (
          <span className="field__req" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {render({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          <Icon name="alertCircle" size={15} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

type InputProps = FieldShellProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { icon?: IconName };

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, hint, error, optional, required, className, icon, id: idProp, ...input },
  ref,
) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      required={required}
      className={className}
      idOverride={idProp}
      render={({ id, describedBy, invalid }) => (
        <div className={`control ${icon ? "control--icon" : ""}`}>
          {icon ? <Icon name={icon} size={18} className="control__icon" /> : null}
          <input
            ref={ref}
            id={id}
            className="input"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            required={required}
            {...input}
          />
        </div>
      )}
    />
  );
});

/** Password input with an accessible show/hide toggle. The toggle is type="button" so it never submits the form. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "icon">>(function PasswordField(
  { label, hint, error, optional, required, className, id: idProp, ...input },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      required={required}
      className={className}
      idOverride={idProp}
      render={({ id, describedBy, invalid }) => (
        <div className="control control--icon control--action">
          <Icon name="lock" size={18} className="control__icon" />
          <input
            ref={ref}
            id={id}
            className="input"
            type={visible ? "text" : "password"}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            required={required}
            autoCapitalize="none"
            spellCheck={false}
            {...input}
          />
          <button
            type="button"
            className="control__action"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            <Icon name={visible ? "eyeOff" : "eye"} size={18} />
          </button>
        </div>
      )}
    />
  );
});

type SelectProps = FieldShellProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">;

export function SelectField({ label, hint, error, optional, required, className, id: idProp, children, ...select }: SelectProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      required={required}
      className={className}
      idOverride={idProp}
      render={({ id, describedBy, invalid }) => (
        <div className="control control--select">
          <select id={id} className="input" aria-invalid={invalid || undefined} aria-describedby={describedBy} required={required} {...select}>
            {children}
          </select>
          <Icon name="chevronDown" size={18} className="control__chevron" />
        </div>
      )}
    />
  );
}

type TextareaProps = FieldShellProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextareaField(
  { label, hint, error, optional, required, className, id: idProp, ...textarea },
  ref,
) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      required={required}
      className={className}
      idOverride={idProp}
      render={({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          className="input input--area"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          {...textarea}
        />
      )}
    />
  );
});
