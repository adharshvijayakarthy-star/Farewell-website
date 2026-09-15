import { useThree } from "@react-three/fiber";
export type PerformanceTier = "HIGH" | "MEDIUM" | "LOW";
export function useDeviceCapability() {
  const { size } = useThree();
  const mobile = size.width < 700;
  const cores =
    typeof navigator === "undefined" ? 8 : navigator.hardwareConcurrency || 4;
  const tier: PerformanceTier = cores <= 4 ? "LOW" : mobile ? "MEDIUM" : "HIGH";
  return {
    mobile,
    tier,
    particles: tier === "LOW" ? 650 : tier === "MEDIUM" ? 1500 : 3000,
    dpr: tier === "HIGH" ? 1.5 : 1,
  };
}
