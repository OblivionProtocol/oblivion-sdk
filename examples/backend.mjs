// Run from a backend project that installed the SDK. No wallet key is needed.
import { OblivionClient } from '@oblivion-protocol/sdk';
const api = new OblivionClient({ apiKey: process.env.OBLIVION_API_KEY });
try {
  const features = await api.features();
  const catalog = await api.assets();
  console.log({ chainId: features.chainId, methods: features.methods, assetCount: catalog.assets.length });
} catch (error) {
  // Do not log response objects or credentials.
  console.error({ code: error.code, status: error.status });
  process.exitCode = 1;
}
