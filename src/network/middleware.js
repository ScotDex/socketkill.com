import { Axiom } from '@axiomhq/js';

export async function onRequest(context) {
  const axiom = new Axiom({ 
    token: context.env.AXIOM_TOKEN, 
    orgId: context.env.AXIOM_ORG_ID 
  });

  // 1. Capture the start time
  const start = Date.now();
  
  // 2. Execute your actual backend logic
  const response = await context.next();

  // 3. Log the metadata (non-blocking)
  context.waitUntil((async () => {
    axiom.ingest('log_events', [{
      method: context.request.method,
      url: context.request.url,
      status: response.status,
      duration_ms: Date.now() - start,
      // You can even pass custom headers or user info here
    }]);
    await axiom.flush();
  })());

  return response;
}