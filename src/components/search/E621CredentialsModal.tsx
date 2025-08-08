'use client';

import React from 'react';

interface E621CredentialsModalProps {
  login: string;
  apiKey: string;
  onChangeLogin: (v: string) => void;
  onChangeKey: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
  storedLogin?: string;
  onClear?: () => void;
}

export default function E621CredentialsModal({ login, apiKey, onChangeLogin, onChangeKey, onSave, onClose, storedLogin, onClear }: E621CredentialsModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>e621 Credentials</h3>
        <p className="modal-description">
          Provide your e621 username and API key (required to view posts with young characters).
        </p>
        {storedLogin && (
          <p className="modal-description">Stored credentials present for user: <strong>{storedLogin}</strong></p>
        )}
        <input
          type="text"
          value={login}
          onChange={(e) => onChangeLogin(e.target.value)}
          placeholder="Username"
          className="api-key-input"
        />
        <input
          type="text"
          value={apiKey}
          onChange={(e) => onChangeKey(e.target.value)}
          placeholder="API Key"
          className="api-key-input"
        />
        <div className="modal-buttons">
          <button onClick={onSave} className="modal-button save">Save</button>
          {onClear && <button onClick={onClear} className="modal-button cancel">Clear credentials</button>}
          <button onClick={onClose} className="modal-button cancel">Close</button>
        </div>
      </div>
    </div>
  );
}
