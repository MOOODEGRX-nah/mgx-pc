import type { ComponentType } from "../types";

/** Catalog tabs. SSD and HDD group two drive types each. */
export const COMPONENT_GROUPS: { key: string; types: ComponentType[] }[] = [
  { key: "case", types: ["case"] },
  { key: "cpu", types: ["cpu"] },
  { key: "gpu", types: ["gpu"] },
  { key: "ram", types: ["ram"] },
  { key: "ssd", types: ["ssd_nvme", "ssd_sata"] },
  { key: "hdd", types: ["hdd_2_5", "hdd_3_5"] },
  { key: "cpu_cooler", types: ["cpu_cooler"] },
  { key: "psu", types: ["psu"] },
  { key: "motherboard", types: ["motherboard"] },
  { key: "accessory", types: ["accessory"] },
];

