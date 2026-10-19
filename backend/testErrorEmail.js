import "dotenv/config";
import { sendErrorEmail } from "./errorEmailReporter.js";

const result = await sendErrorEmail("TEST_ERROR_EMAIL", {
  status: 500,
  message: "Teste manual do monitor de erros",
  request: { method: "TEST", path: "/diagnostico/email" },
  err: { message: "Este é somente um teste; nenhum erro real aconteceu." },
});

if (!result.sent) {
  console.error("E-mail não enviado. Confira ERROR_EMAIL_ENABLED e as configurações SMTP.");
  process.exitCode = 1;
} else {
  console.log("E-mail de teste enviado com sucesso.");
}
