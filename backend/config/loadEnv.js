// Carrega o .env e garante que a credencial GCP do .env prevaleça sobre a
// variável GOOGLE_APPLICATION_CREDENTIALS global do Windows (que aponta para
// a service account de outro projeto). No Cloud Run o .env não é enviado,
// então nada muda lá.
import dotenv from 'dotenv';

const { parsed = {} } = dotenv.config();

if (parsed.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = parsed.GOOGLE_APPLICATION_CREDENTIALS;
}
