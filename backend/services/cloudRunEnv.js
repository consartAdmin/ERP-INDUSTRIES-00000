// Atualiza ENV vars do Cloud Run via API v2
import { GoogleAuth } from 'google-auth-library';

const RUN_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

export async function updateCloudRunEnv({
  projectId,
  region,
  serviceName,
  envVars = {}, // { KEY: "value" }
}) {
  const auth = new GoogleAuth({ scopes: [RUN_SCOPE] });
  const client = await auth.getClient();

  const name = `projects/${projectId}/locations/${region}/services/${serviceName}`;

  // Get service
  const { data: service } = await client.request({
    url: `https://run.googleapis.com/v2/${name}`,
    method: 'GET',
  });

  // Merge envs
  const tmpl = service?.template || service?.template?.template || service?.spec?.template || service?.template;
  if (!tmpl || !tmpl.containers || !tmpl.containers.length) {
    throw new Error('Template do Cloud Run não encontrado.');
  }
  const container = tmpl.containers[0];

  const existing = {};
  for (const e of container.env || []) existing[e.name] = e.value;

  for (const [k, v] of Object.entries(envVars)) {
    existing[k] = String(v);
  }

  container.env = Object.entries(existing).map(([name, value]) => ({ name, value }));

  // Patch
  const { data: op } = await client.request({
    url: `https://run.googleapis.com/v2/${name}`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    params: { updateMask: 'template.containers.env' },
    data: { template: { containers: [container] } },
  });

  return op;
}
