'use strict';

export const API_BASE = (window.apiBase || window.API_BASE || location.origin).replace(/\/$/, '');
export const MOBILIZED_API = `${API_BASE}/api/mobilized`;
export const DEFAULT_LIMIT = 50;
export const DEFAULT_STATUS = 'ACTIVE';
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

