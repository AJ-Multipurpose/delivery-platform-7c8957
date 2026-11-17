import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.dailybasicdelivery.customer",
  appName: "DBD App",
  webDir: "www",
  server: { url: "https://app.dailybasicdelivery.com", cleartext: false },
  android: { allowMixedContent: false },
};
export default config;
