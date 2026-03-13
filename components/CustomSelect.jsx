"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  label,
  required = false,
  name,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="customSelect" ref={rootRef}>
      {label ? <span className="customSelectLabel">{label}</span> : null}
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        className={`customSelectTrigger ${open ? "isOpen" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label || placeholder}</span>
        <span className="customSelectCaret" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div id={listboxId} className="customSelectMenu" role="listbox" aria-label={label || placeholder}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "customSelectOption selected" : "customSelectOption"}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <style jsx>{`
        .customSelect {
          position: relative;
          display: grid;
          gap: 7px;
        }
        .customSelectLabel {
          color: #e0ebfb;
          font-size: 0.92rem;
        }
        .customSelectTrigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: #f4f8ff;
          font: inherit;
          cursor: pointer;
          text-align: left;
        }
        .customSelectTrigger.isOpen {
          border-color: rgba(126, 174, 255, 0.4);
        }
        .customSelectCaret {
          color: #8eb6ff;
          font-size: 0.95rem;
          line-height: 1;
        }
        .customSelectMenu {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          z-index: 20;
          display: grid;
          gap: 4px;
          padding: 8px;
          border-radius: 16px;
          border: 1px solid rgba(160, 193, 255, 0.12);
          background: linear-gradient(180deg, rgba(13, 23, 34, 0.98), rgba(12, 22, 32, 0.98));
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
        }
        .customSelectOption {
          border: 0;
          border-radius: 12px;
          padding: 10px 12px;
          background: transparent;
          color: #edf4ff;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .customSelectOption:hover,
        .customSelectOption.selected {
          background: rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </div>
  );
}
