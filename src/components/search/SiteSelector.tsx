'use client';

import Image from 'next/image';
import React from 'react';
import { Site } from '@/lib/api';

export interface SiteItem { value: Site; label: string; icon: string; needsApiKey?: boolean; defaultRating: string }

interface SiteSelectorProps {
  sites: SiteItem[];
  currentSite: Site;
  onSelect: (s: Site) => void;
  desktop?: boolean;
}

export default function SiteSelector({ sites, currentSite, onSelect, desktop }: SiteSelectorProps) {
  return (
    <div className={`site-selector ${desktop ? 'desktop-only' : 'mobile-only'}`}>
      <button type="button" className="site-selector-button">
        <Image src={(sites.find(s => s.value === currentSite) || sites[0]).icon} alt={(sites.find(s => s.value === currentSite) || sites[0]).label} width={16} height={16} className="site-icon" />
        <span className={desktop ? 'site-name-desktop' : 'site-name'}>
          {(sites.find(s => s.value === currentSite) || sites[0]).label}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="dropdown-arrow">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div className="site-dropdown">
        {sites.map((site) => (
          <button key={site.value} type="button" className={`site-option ${currentSite === site.value ? 'active' : ''}`} onClick={() => onSelect(site.value)}>
            <Image src={site.icon} alt={site.label} width={16} height={16} className="site-icon" />
            <span>{site.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
