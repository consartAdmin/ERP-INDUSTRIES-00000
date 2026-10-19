const byId = (id) => document.getElementById(id);
export const elements = {
  typeNameInput: byId('typeName'),
  typeCodeInput: byId('typeCode'), typeColorInput: byId('typeColor'),
  typeColorPicker: byId('typeColorPicker'), typeColorPreview: byId('typeColorPreview'),
  typeOrderInput: byId('typeOrder'), typesTableBody: byId('typesTableBody'),
  btnCreateType: byId('btnCreateType'),
  btnReload: byId('btnReload'), btnOpenTypeModal: byId('btnOpenTypeModal'),
  btnCloseTypeModal: byId('btnCloseTypeModal'), btnCancelTypeModal: byId('btnCancelTypeModal'),
  typeModal: byId('typeModal'),
  apTableInfo: byId('apTableInfo')

};

