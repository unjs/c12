// @ts-expect-error virtual module provided via jitiOptions.virtualModules
import { value } from "virtual:jiti-options";

enum _Force {
  Jiti,
}

export default {
  value,
};
