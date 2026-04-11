import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from 'date-fns';

export const formatDate = (date, fmt = 'MMM d, yyyy') => {
  if (!date) return '—';
  try {
    return format(typeof date === 'string' ? parseISO(date) : date, fmt);
  } catch { return '—'; }
};

export const formatDateTime = (date) => formatDate(date, 'MMM d, yyyy h:mm a');
export const formatTime = (date) => formatDate(date, 'h:mm a');

export const timeAgo = (date) => {
  if (!date) return '';
  try {
    return formatDistanceToNow(typeof date === 'string' ? parseISO(date) : date, { addSuffix: true });
  } catch { return ''; }
};

export const formatCurrency = (value, currency = 'USD') => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
};

export const formatNumber = (num) => {
  if (!num) return '0';
  return new Intl.NumberFormat('en-US').format(num);
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getAvatarColor = (name) => {
  const colors = [
    '#3e72ae', '#6b5ea8', '#e67e22', '#27ae60',
    '#e74c3c', '#16a085', '#8e44ad', '#2980b9',
  ];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
};

export const getPriorityColor = (priority) => {
  const map = {
    critical: '#dc3545',
    high: '#e67e22',
    medium: '#f59e0b',
    low: '#28a745',
  };
  return map[priority] || '#718096';
};

export const getMeetingLabel = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
};

export const truncate = (str, len = 50) => {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
};

export const slugify = (str) =>
  str?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || '';

export const getSourceIcon = (source) => {
  const map = { whatsapp: 'WhatsApp', email: 'Email', manual: 'Manual', teams: 'Teams' };
  return map[source] || (source || 'Direct');
};

export const formatRoleName = (roleName) => {
  const map = {
    system_admin: 'System Admin',
    super_admin: 'Super Admin',
    pre_sales_manager: 'Pre-Sales Manager',
    pre_sales_executive: 'Pre-Sales Executive',
  };
  return map[roleName] || roleName;
};
