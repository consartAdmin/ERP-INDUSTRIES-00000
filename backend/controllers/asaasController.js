// 📦 backend/controllers/asaasController.js

import asaasApi from '../repositories/asaas/asaas.index.js';

const LIMITE_SINCRONIZACAO = 100;

function obterMensagemErro(error) {
  return (
    error?.response?.data?.errors?.[0]?.description ||
    error?.response?.data?.message ||
    error?.message ||
    'Erro desconhecido'
  );
}

// 🔄 Sincronizar clientes do ERP que ainda não possuem ASAAS ID
export async function sincronizarClientes(req, res) {
  try {
    const clientes = await Customer.findAll({
      where: {
        [Op.or]: [
          { asaas_id: null },
          { asaas_id: '' },
        ],
      },
      limit: LIMITE_SINCRONIZACAO,
      order: [['id', 'ASC']],
    });

    const resultado = {
      encontrados: clientes.length,
      sincronizados: 0,
      falhas: 0,
      erros: [],
    };

    for (const cliente of clientes) {
      try {
        const asaasId = await asaasApi.ensureAsaasCustomerForEcommerce({
          externalReference: String(cliente.id),
          name: cliente.nome,
          email: cliente.email,
          cpfCnpj: cliente.cpf_cnpj,
          phone: cliente.telefone,
          mobilePhone: cliente.celular,
        });

        if (!asaasId) {
          throw new Error('O Asaas não retornou o ID do cliente.');
        }

        await cliente.update({ asaas_id: asaasId });
        resultado.sincronizados += 1;
      } catch (error) {
        resultado.falhas += 1;
        resultado.erros.push({
          clienteId: cliente.id,
          erro: obterMensagemErro(error),
        });

        console.error(
          `❌ Falha ao sincronizar cliente ${cliente.id}:`,
          obterMensagemErro(error)
        );
      }
    }

    const clientesRestantes = await Customer.count({
      where: {
        [Op.or]: [
          { asaas_id: null },
          { asaas_id: '' },
        ],
      },
    });

    return res.status(200).json({
      ok: true,
      ...resultado,
      restantes: clientesRestantes,
      possuiMais: clientesRestantes > 0,
    });
  } catch (error) {
    console.error('❌ Erro sincronizarClientes:', obterMensagemErro(error));

    return res.status(500).json({
      ok: false,
      erro: 'Erro ao sincronizar clientes com o Asaas',
      detalhe: obterMensagemErro(error),
    });
  }
}

// 🔎 Buscar nome do cliente pelo ID do Asaas
async function buscarCliente(id) {
  try {
    const cliente = await asaasApi.getCustomer(id);
    return cliente?.name || id;
  } catch {
    return id;
  }
}

// 📄 Listar cobranças
export async function listarCobrancas(req, res) {
  try {
    const { status, dataInicio, dataFim, tipoData, sort, order } = req.query;

    const params = { limit: 100 };
    if (status) params.status = status;
    if (sort) params.sort = sort;
    if (order) params.order = order;

    if (tipoData && dataInicio && dataFim) {
      params[`${tipoData}[ge]`] = dataInicio;
      params[`${tipoData}[le]`] = dataFim;
    }

    const resultado = await asaasApi.listCharges(params);
    const lista = Array.isArray(resultado?.data) ? resultado.data : [];

    const cobrancas = await Promise.all(
      lista.map(async (cobranca) => ({
        ...cobranca,
        clienteNome: await buscarCliente(cobranca.customer),
      }))
    );

    return res.status(200).json(cobrancas);
  } catch (error) {
    console.error('❌ Erro listarCobrancas:', obterMensagemErro(error));
    return res.status(500).json({ erro: 'Erro ao listar cobranças' });
  }
}

// 💾 Criar cobrança
export async function criarCobranca(req, res) {
  try {
    const retorno = await asaasApi.createCharge(req.body);
    return res.status(201).json(retorno);
  } catch (error) {
    console.error('❌ Erro criarCobranca:', obterMensagemErro(error));
    return res.status(500).json({ erro: 'Erro ao criar cobrança' });
  }
}

// ❌ Cancelar cobrança
export async function cancelarCobranca(req, res) {
  try {
    const retorno = await asaasApi.cancelPayment(req.params.id);
    return res.status(200).json(retorno);
  } catch (error) {
    console.error('❌ Erro cancelarCobranca:', obterMensagemErro(error));
    return res.status(500).json({ erro: 'Erro ao cancelar cobrança' });
  }
}

// 📊 Pagamentos confirmados
export async function pagamentosConfirmados(req, res) {
  try {
    const dados = await asaasApi.listConfirmedPayments();
    const pagamentos = Array.isArray(dados?.data) ? dados.data : [];
    const total = pagamentos.reduce(
      (acumulado, pagamento) => acumulado + Number(pagamento.value || 0),
      0
    );

    return res.status(200).json({
      total,
      liquido: '-',
      qtdClientes: '-',
      qtdCobrancas: pagamentos.length,
    });
  } catch (error) {
    console.error('❌ Erro pagamentosConfirmados:', obterMensagemErro(error));
    return res.status(500).json({ erro: 'Erro ao buscar pagamentos confirmados' });
  }
}

// 💰 Saldo
export async function saldo(req, res) {
  try {
    const dados = await asaasApi.getBalance();
    return res.status(200).json(dados);
  } catch (error) {
    console.error('❌ Erro saldo:', obterMensagemErro(error));
    return res.status(500).json({ erro: 'Erro ao buscar saldo' });
  }
}

// 📊 Aguardando pagamento (espelho do painel Asaas)
// Use este endpoint para o card "À Vencer" do ERP.
export async function aguardandoPagamentoMes(req, res) {
  try {
    const { from, to } = req.query;

    const dados = from || to
      ? await asaasApi.listPendingByDueDateRange(from, to)
      : await asaasApi.listPendingThisMonth();

    const pagamentos = Array.isArray(dados?.data) ? dados.data : [];

    const totalBruto = pagamentos.reduce(
      (acumulado, pagamento) => acumulado + Number(pagamento.value || 0),
      0
    );

    const totalLiquido = pagamentos.reduce(
      (acumulado, pagamento) => acumulado + Number(pagamento.netValue || 0),
      0
    );

    return res.status(200).json({
      ok: true,
      totalBruto,
      totalLiquido,
      qtdClientes: dados?.summary?.customersCount ?? null,
      qtdCobrancas: dados?.totalCount ?? pagamentos.length,
    });
  } catch (error) {
    console.error('❌ Erro aguardandoPagamentoMes:', obterMensagemErro(error));
    return res.status(500).json({
      ok: false,
      erro: 'Erro ao buscar cobranças aguardando pagamento',
    });
  }
}

/*
ROTA NECESSÁRIA EM backend/routes/asaasRoutes.js:

1. Inclua sincronizarClientes no import do controller.

2. Registre a rota, protegida pelo middleware administrativo do sistema:

router.post('/clientes/sincronizar', sincronizarClientes);

IMPORTANTE:
- Este controller pressupõe o model ../models/Customer.js.
- Campos pressupostos: id, nome, email, cpf_cnpj, telefone, celular e asaas_id.
- ensureAsaasCustomerForEcommerce deve aceitar externalReference e enviá-lo ao
  Asaas ao criar o cliente.
- Cada chamada processa no máximo 100 registros. Repita enquanto possuiMais
  for true.
*/