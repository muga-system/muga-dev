// @ts-nocheck
import dynamic from "next/dynamic";

const WorldLeadsMapClient = dynamic(
  () => import("./world-leads-map.client"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          height: 360,
          borderRadius: 0,
          background: "#191717",
          border: "1px solid #3A3A3A",
        }}
      />
    ),
  },
);

export default WorldLeadsMapClient;
