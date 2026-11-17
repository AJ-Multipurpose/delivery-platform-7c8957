import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.dailybasicdelivery.driver",
  appName: "DBD Driver",
  webDir: "www",
  server: { url: "https://driver.dailybasicdelivery.com", cleartext: false },
  android: { allowMixedContent: false },
};
export default config;
