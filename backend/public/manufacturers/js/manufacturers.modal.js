export {
  openManufacturerModal,
  closeManufacturerModal,
  fillManufacturerForm,
  initManufacturerModal,
} from './modalManufacturers.js';

export function showMessage(message) {
  window.alert(message);
}

export function confirmDelete(message) {
  return window.confirm(message);
}
