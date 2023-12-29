import { expectTypeOf } from "expect-type";
import { loadConfig, createDefineConfig } from "../src";

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
}
