import { useEffect, useState } from 'react';

const OTHER = '__diger__';

interface Props {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  ariaLabel?: string;
}

/**
 * Hazır seçenek listesi + "Diğer…" seçeneği. Listede olmayan bir değer gerekiyorsa
 * "Diğer…" seçilir ve altında serbest yazı alanı açılır.
 */
export function ChoiceField({ value, options, onChange, placeholder = 'Yazınız', maxLength = 40, ariaLabel }: Props) {
  const [other, setOther] = useState(value !== '' && !options.includes(value));
  useEffect(() => {
    if (value !== '' && !options.includes(value)) setOther(true);
  }, [value, options]);

  return (
    <div className="choice-field">
      <select
        aria-label={ariaLabel}
        value={other ? OTHER : value}
        onChange={(e) => {
          const v = e.target.value;
          setOther(v === OTHER);
          onChange(v === OTHER ? '' : v);
        }}
      >
        <option value="">Seçiniz</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={OTHER}>Diğer…</option>
      </select>
      {other && (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} autoFocus aria-label={ariaLabel ? `${ariaLabel} (diğer)` : undefined} />
      )}
    </div>
  );
}
