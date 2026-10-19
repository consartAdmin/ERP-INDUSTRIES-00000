export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function showToast(message, type = 'sucesso') {
  const notification = document.createElement('div');

  notification.className = `toast ${type}`;
  notification.role = type === 'erro' ? 'alert' : 'status';
  notification.textContent = message;

  document.body.append(notification);
  setTimeout(() => notification.remove(), 3000);
}
