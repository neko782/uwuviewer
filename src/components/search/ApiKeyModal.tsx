'use client';

import React from 'react';

interface ApiKeyModalProps {
  apiKeyInput: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function ApiKeyModal({ apiKeyInput, onChange, onSave, onClose }: ApiKeyModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Gelbooru API Key</h3>
        <p className="modal-description">
          Enter your Gelbooru API credentials (required to access the API). Use the format: &amp;api_key=xxx&amp;user_id=yyy
        </p>
        <input
          type="text"
          value={apiKeyInput}
          onChange={(e) => onChange(e.target.value)}
          placeholder="&api_key=your_key&user_id=your_id"
          className="api-key-input"
        />
        <div className="modal-buttons">
          <button onClick={onSave} className="modal-button save">Save</button>
          <button onClick={onClose} className="modal-button cancel">Cancel</button>
        </div>
      </div>
    </div>
  );
}
