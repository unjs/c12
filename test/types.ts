import { expectTypeOf } from "expect-type";
import { loadConfig, InputConfig } from "../src";

interface MyConfig {
  foo: string;
}

interface MyMeta {
  metaFoo: string;
}

type UserConfig = InputConfig<MyConfig, MyMeta>;

const userConfig: UserConfig = {
  foo: "bar",
  $meta: {
    metaFoo: "bar",
  },
  $development: {
    foo: "bar",
  },
};

expectTypeOf(userConfig.$production!.foo).toEqualTypeOf<string>();
expectTypeOf(userConfig.$meta!.metaFoo).toEqualTypeOf<string>();

async function main() {
  const config = await loadConfig<MyConfig, MyMeta>({});
  expectTypeOf(config.config!.foo).toEqualTypeOf<string>();
  expectTypeOf(config.meta!.metaFoo).toEqualTypeOf<string>();
}
