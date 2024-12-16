export default defineTestGlobalFnConfig({ it: 'works' });

declare global {
  const defineTestGlobalFnConfig: <T>(c: T) => T
}
