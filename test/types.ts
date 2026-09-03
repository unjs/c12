import { expectTypeOf } from "expect-type";
import { z } from "zod";
import { loadConfig, watchConfig, createDefineConfig } from "../src/index.ts";

interface MyConfig {
  foo: string;
}

interface MyMeta {
  metaFoo: string;
}

const defineMyConfig = createDefineConfig<MyConfig, MyMeta>();

const userConfig = defineMyConfig({
  foo: "bar",
  $meta: {
    metaFoo: "bar",
  },
  $development: {
    foo: "bar",
  },
});

expectTypeOf(userConfig.$production!.foo).toEqualTypeOf<string>();
expectTypeOf(userConfig.$meta!.metaFoo).toEqualTypeOf<string>();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function main() {
  const config = await loadConfig<MyConfig, MyMeta>({});
  expectTypeOf(config.config!.foo).toEqualTypeOf<string>();
  expectTypeOf(config.meta!.metaFoo).toEqualTypeOf<string>();

  // Config type is inferred from the schema
  const schema = z.object({ foo: z.string(), bar: z.number().default(0) });
  const validated = await loadConfig({ schema });
  expectTypeOf(validated.config.foo).toEqualTypeOf<string>();
  expectTypeOf(validated.config.bar).toEqualTypeOf<number>();

  // Explicit generics keep working next to a schema (schema output is not inferred)
  const explicit = await loadConfig<MyConfig, MyMeta>({ schema });
  expectTypeOf(explicit.config!.foo).toEqualTypeOf<string>();
  expectTypeOf(explicit.meta!.metaFoo).toEqualTypeOf<string>();

  // watchConfig infers from the schema too
  const watched = await watchConfig({
    schema,
    acceptHMR: ({ newConfig }) => {
      expectTypeOf(newConfig.config.foo).toEqualTypeOf<string>();
    },
  });
  expectTypeOf(watched.config.foo).toEqualTypeOf<string>();
}
