// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LeadProperties = {
  email?: string;
  country?: string;
  [key: string]: unknown;
};

type LeadFeature = {
  type: "Feature";
  properties?: LeadProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
};

export type LeadsFeatureCollection = {
  type: "FeatureCollection";
  features: LeadFeature[];
};

type WorldLeadsMapClientProps = {
  leads: LeadsFeatureCollection;
  className?: string;
  height?: number;
};

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  email: string;
  country: string;
};

const LEADS_SOURCE_ID = "muga-leads";
const LEADS_LAYER_ID = "muga-leads-circles";

const EMPTY_COLLECTION: LeadsFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const shouldHideLayer = (id: string) => {
  const hiddenTokens = [
    "label",
    "poi",
    "road",
    "street",
    "highway",
    "rail",
    "transit",
    "aeroway",
    "airport",
    "building",
    "housenumber",
  ];
  return hiddenTokens.some((token) => id.includes(token));
};

const applyMugaMapTheme = (map: any) => {
  const layers = map.getStyle()?.layers || [];

  layers.forEach((layer: any) => {
    const id = String(layer.id || "").toLowerCase();

    if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", "#191717");
      return;
    }

    if (shouldHideLayer(id) || layer.type === "symbol") {
      map.setLayoutProperty(layer.id, "visibility", "none");
      return;
    }

    if (layer.type === "fill") {
      if (id.includes("water") || id.includes("ocean") || id.includes("sea")) {
        map.setPaintProperty(layer.id, "fill-color", "#191717");
        map.setPaintProperty(layer.id, "fill-opacity", 1);
        return;
      }

      if (id.includes("land") || id.includes("earth") || id.includes("park") || id.includes("grass")) {
        map.setPaintProperty(layer.id, "fill-color", "#2D2E2E");
        map.setPaintProperty(layer.id, "fill-opacity", 1);
      }
    }

    if (layer.type === "line") {
      if (id.includes("boundary") || id.includes("admin") || id.includes("country")) {
        map.setPaintProperty(layer.id, "line-color", "#3A3A3A");
        map.setPaintProperty(layer.id, "line-opacity", 0.9);
      }
    }
  });
};

export default function WorldLeadsMapClient({
  leads,
  className,
  height = 360,
}: WorldLeadsMapClientProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    email: "",
    country: "",
  });

  const stableLeads = useMemo(() => leads || EMPTY_COLLECTION, [leads]);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!mapContainerRef.current || mapRef.current) return;

      const module = await import("maplibre-gl");
      const maplibregl = module.default;
      if (!mapContainerRef.current || cancelled) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json",
        center: [0, 20],
        zoom: 1.4,
        projection: { type: "mercator" },
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        applyMugaMapTheme(map);

        if (!map.getSource(LEADS_SOURCE_ID)) {
          map.addSource(LEADS_SOURCE_ID, {
            type: "geojson",
            data: stableLeads,
          });
        }

        if (!map.getLayer(LEADS_LAYER_ID)) {
          map.addLayer({
            id: LEADS_LAYER_ID,
            type: "circle",
            source: LEADS_SOURCE_ID,
            paint: {
              "circle-radius": 6,
              "circle-color": "#FF5353",
              "circle-opacity": 0.9,
            },
          });
        }

        map.on("mousemove", LEADS_LAYER_ID, (event: any) => {
          const feature = event.features?.[0];
          if (!feature) return;

          const email = String(feature.properties?.email || "sin email");
          const country = String(feature.properties?.country || "-");

          setTooltip({
            visible: true,
            x: event.point.x,
            y: event.point.y,
            email,
            country,
          });

          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", LEADS_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
          setTooltip((prev) => ({ ...prev, visible: false }));
        });
      });
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stableLeads]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource(LEADS_SOURCE_ID);
    if (source && "setData" in source) {
      source.setData(stableLeads);
    }
  }, [stableLeads]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: 0,
        background: "#191717",
        overflow: "hidden",
      }}
    >
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 0,
          boxShadow: "none",
        }}
      />

      {tooltip.visible ? (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            pointerEvents: "none",
            borderRadius: 0,
            background: "#191717",
            border: "1px solid #3A3A3A",
            color: "#f5f5f5",
            fontSize: 12,
            lineHeight: 1.3,
            padding: "8px 10px",
            zIndex: 10,
            maxWidth: 220,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.email}</div>
          <div style={{ opacity: 0.85 }}>{tooltip.country}</div>
        </div>
      ) : null}
    </div>
  );
}
