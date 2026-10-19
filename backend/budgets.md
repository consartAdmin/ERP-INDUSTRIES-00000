| 🧩 Operação                              | ⚙️ Verbo HTTP | 🌐 Caminho                  | 🧪 Exemplo                      | 🧠 Função no Controller |
| ---------------------------------------- | ------------- | --------------------------- | ------------------------------- | ----------------------- |
| **Listar vários registros**              | `GET`         | `/api/budgets`              | `GET /api/budgets`              | `listarBudgets`         |
| **Buscar 1 registro específico**         | `GET`         | `/api/budgets/:id`          | `GET /api/budgets/123`          | `obterBudgetPorId`      |
| **Buscar 1 registro completo/detalhado** | `GET`         | `/api/budgets/:id/completo` | `GET /api/budgets/123/completo` | `getBudgetCompleto`     |
| **Criar novo registro**                  | `POST`        | `/api/budgets`              | `POST /api/budgets`             | `criarBudget`           |
| **Atualizar registro existente**         | `PUT`         | `/api/budgets/:id`          | `PUT /api/budgets/123`          | `atualizarBudget`       |
| **Excluir registro**                     | `DELETE`      | `/api/budgets/:id`          | `DELETE /api/budgets/123`       | `excluirBudget`         |


| #     | Método   | URL completa                                                                                             | Descrição                                                                                                                |
| ----- | -------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **1** | `GET`    | [http://erp.consart.com.br/api/budgets](http://erp.consart.com.br/api/budgets)                           | **Listar** orçamentos com filtros e paginação. <br> 🔍 Parâmetros opcionais: `q`, `status`, `de`, `ate`, `page`, `limit` |


| **2** | `GET`    | [http://erp.consart.com.br/api/budgets/:id](http://erp.consart.com.br/api/budgets/:id)                   | **Buscar** 1 orçamento (cabeçalho simples)                                                                               |


| **3** | `GET`    | [http://erp.consart.com.br/api/budgets/:id/completo](http://erp.consart.com.br/api/budgets/:id/completo) | **Buscar** orçamento completo (cabeçalho + itens + pagamento)                                                            |


| **4** | `POST`   | [http://erp.consart.com.br/api/budgets](http://erp.consart.com.br/api/budgets)                           | **Criar** novo orçamento                                                                                                 |


| **5** | `PUT`    | [http://erp.consart.com.br/api/budgets/:id](http://erp.consart.com.br/api/budgets/:id)                   | **Atualizar** orçamento existente                                                                                        |


| **6** | `DELETE` | [http://erp.consart.com.br/api/budgets/:id](http://erp.consart.com.br/api/budgets/:id)                   | **Excluir** orçamento                                                                                                    |



**                                              **[MIGRANDO BACKEND PARA FRONTEND]**

