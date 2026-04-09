import React, { useState, useEffect } from 'react';
import './PhoneInput.css';

const COUNTRY_CODES = [
  { code: '+1', label: '+1 (US/CA)' },
  { code: '+7', label: '+7 (RU/KZ)' },
  { code: '+20', label: '+20 (EG)' },
  { code: '+27', label: '+27 (ZA)' },
  { code: '+30', label: '+30 (GR)' },
  { code: '+31', label: '+31 (NL)' },
  { code: '+32', label: '+32 (BE)' },
  { code: '+33', label: '+33 (FR)' },
  { code: '+34', label: '+34 (ES)' },
  { code: '+39', label: '+39 (IT)' },
  { code: '+40', label: '+40 (RO)' },
  { code: '+41', label: '+41 (CH)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+45', label: '+45 (DK)' },
  { code: '+46', label: '+46 (SE)' },
  { code: '+47', label: '+47 (NO)' },
  { code: '+48', label: '+48 (PL)' },
  { code: '+49', label: '+49 (DE)' },
  { code: '+55', label: '+55 (BR)' },
  { code: '+60', label: '+60 (MY)' },
  { code: '+61', label: '+61 (AU)' },
  { code: '+62', label: '+62 (ID)' },
  { code: '+63', label: '+63 (PH)' },
  { code: '+64', label: '+64 (NZ)' },
  { code: '+65', label: '+65 (SG)' },
  { code: '+66', label: '+66 (TH)' },
  { code: '+81', label: '+81 (JP)' },
  { code: '+82', label: '+82 (KR)' },
  { code: '+84', label: '+84 (VN)' },
  { code: '+86', label: '+86 (CN)' },
  { code: '+90', label: '+90 (TR)' },
  { code: '+91', label: '+91 (IN)' },
  { code: '+92', label: '+92 (PK)' },
  { code: '+93', label: '+93 (AF)' },
  { code: '+94', label: '+94 (LK)' },
  { code: '+95', label: '+95 (MM)' },
  { code: '+971', label: '+971 (AE)' },
  { code: '+972', label: '+972 (IL)' },
  { code: '+974', label: '+974 (QA)' },
  { code: '+966', label: '+966 (SA)' },
  { code: '+962', label: '+962 (JO)' },
  { code: '+961', label: '+961 (LB)' },
  { code: '+968', label: '+968 (OM)' },
  { code: '+973', label: '+973 (BH)' },
  { code: '+880', label: '+880 (BD)' },
  { code: '+98', label: '+98 (IR)' },
];

// Parse a full phone string into {countryCode, number}
function parse(full = '') {
  const str = full.trim();
  if (!str) return { countryCode: '+1', number: '' };
  // Try to match longest country code first
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const cc of sorted) {
    if (str.startsWith(cc.code)) {
      return { countryCode: cc.code, number: str.slice(cc.code.length).trim() };
    }
  }
  // If starts with + but unknown code, keep as-is in number
  if (str.startsWith('+')) return { countryCode: '+1', number: str };
  return { countryCode: '+1', number: str };
}

export default function PhoneInput({ value = '', onChange, placeholder = '123 456 7890', className = '', disabled = false }) {
  const parsed = parse(value);
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [number, setNumber] = useState(parsed.number);

  // Sync when external value changes (e.g. when editing existing user)
  useEffect(() => {
    const p = parse(value);
    setCountryCode(p.countryCode);
    setNumber(p.number);
  }, [value]); // value is the only dependency needed here

  const handleCodeChange = (code) => {
    setCountryCode(code);
    onChange(`${code} ${number}`.trim());
  };

  const handleNumberChange = (num) => {
    setNumber(num);
    onChange(`${countryCode} ${num}`.trim());
  };

  return (
    <div className={`phone-input-wrap ${className}`}>
      <select
        className="phone-cc-select"
        value={countryCode}
        onChange={e => handleCodeChange(e.target.value)}
        disabled={disabled}
      >
        {COUNTRY_CODES.map(cc => (
          <option key={cc.code} value={cc.code}>{cc.label}</option>
        ))}
      </select>
      <input
        className="phone-number-input"
        type="tel"
        placeholder={placeholder}
        value={number}
        onChange={e => handleNumberChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
