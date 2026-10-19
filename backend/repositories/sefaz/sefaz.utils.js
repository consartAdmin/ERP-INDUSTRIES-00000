// ╔════════════════════════════════════════════════════════════════════╗
// ║ sefaz.utils.js — Helpers puros + cadastro SEFAZ mockado            ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Remove tudo que não for dígito.
 */
export function onlyDigits(v = '') {
  return String(v).replace(/\D+/g, '');
}

/**
 * 🔁 Mapeia o CNPJ para um “cadastro SEFAZ” mockado.
 * Aqui você pode ir adicionando outros CNPJs depois, se quiser.
 */
export function getMockCadastroByCnpj(cnpjDigits) {
  // CNPJ da BH3: 34.363.337/0001-85
  if (cnpjDigits === '34363337000185') {
    return {
      // Documentos
      cnpj: '34363337000185',
      cpfCnpj: '34363337000185',

      // Nome / Fantasia
      nome: 'BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA',
      razao_social: 'BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA',
      fantasia: 'BH3 DISTRIBUIDORA',

      // 🔹 Inscrições  → AQUI VOCÊ AJUSTA PARA O VALOR REAL
      inscricao_estadual: 'INSCRICAO_ESTADUAL_AQUI', // ← coloque a IE correta da BH3
      inscricao_municipal: null, // se tiver, pode preencher também

      // Contato
      email: 'vendas@bh3distribuidora.com.br',
      telefone: '(31) 3566-0070',

      // Endereço
      cep: '30170012',
      logradouro: 'AVENIDA BIAS FORTES',
      numero: '784',
      complemento: null,
      bairro: 'LOURDES',
      municipio: 'BELO HORIZONTE',
      uf: 'MG'
    };
  }

  return null;
}
