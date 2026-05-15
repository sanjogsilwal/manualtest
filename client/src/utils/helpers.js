export function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

export function fileIcon(type) {
  return (type || 'FILE').toString().toUpperCase();
}

const _deptLabelCache = { automobile: 'Automobile', mechanical: 'Mechanical' };

export function deptLabel(d) {
  if (!d) return '';
  if (_deptLabelCache[d]) return _deptLabelCache[d];
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export function setDeptLabel(code, name) {
  if (code && name) _deptLabelCache[code] = name;
}
