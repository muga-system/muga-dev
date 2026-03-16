import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { geoCentroid } from "d3-geo";

export interface Props {
  countryCounts: Record<string, number>;
  argentinaProvinceCounts?: Record<string, number>;
  className?: string;
}

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const ARGENTINA_GEO_URL =
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ARG/ADM1/geoBoundaries-ARG-ADM1_simplified.geojson";

const COUNTRY_NAME_BY_CODE: Record<string, string> = {
  AR: "Argentina",
  BR: "Brazil",
  CL: "Chile",
  UY: "Uruguay",
  PY: "Paraguay",
  BO: "Bolivia",
  US: "United States of America",
  CA: "Canada",
  MX: "Mexico",
  ES: "Spain",
  PT: "Portugal",
  FR: "France",
  DE: "Germany",
  IT: "Italy",
  GB: "United Kingdom",
  CO: "Colombia",
  PE: "Peru",
  AU: "Australia",
};

const COUNTRY_NAME_ALIASES: Record<string, string[]> = {
  US: ["United States", "United States of America"],
  GB: ["United Kingdom", "UK", "Great Britain"],
};

const ARGENTINA_PROVINCE_COORDS: Record<string, [number, number]> = {
  "Buenos Aires": [-58.5, -36.7],
  CABA: [-58.43, -34.6],
  Catamarca: [-65.78, -28.47],
  Chaco: [-59.0, -26.4],
  Chubut: [-66.2, -43.5],
  Cordoba: [-64.2, -31.4],
  Corrientes: [-58.8, -28.8],
  "Entre Rios": [-59.2, -32.1],
  Formosa: [-58.2, -24.9],
  Jujuy: [-65.3, -23.5],
  "La Pampa": [-64.9, -36.5],
  "La Rioja": [-66.85, -29.4],
  Mendoza: [-68.9, -34.5],
  Misiones: [-55.8, -27.4],
  Neuquen: [-69.1, -38.9],
  "Rio Negro": [-67.4, -40.3],
  Salta: [-65.4, -24.8],
  "San Juan": [-68.5, -30.4],
  "San Luis": [-66.3, -33.7],
  "Santa Cruz": [-69.2, -49.2],
  "Santa Fe": [-60.7, -31.0],
  "Santiago del Estero": [-63.9, -27.8],
  "Tierra del Fuego": [-67.7, -54.4],
  Tucuman: [-65.3, -26.8],
};

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ARGENTINA_PROVINCE_NAME_OVERRIDES: Record<string, string> = {
  caba: "Ciudad Autonoma de Buenos Aires",
  "ciudad autonoma de buenos aires": "Ciudad Autonoma de Buenos Aires",
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatCount = (value: number) => value.toLocaleString("es-AR");

const buildProportionalRadius = (
  count: number,
  max: number,
  range: { min: number; max: number },
) => {
  if (!Number.isFinite(count) || count <= 0 || max <= 0) return 0;
  const normalized = Math.sqrt(count / max);
  return range.min + normalized * (range.max - range.min);
};

const DEFAULT_WORLD_POSITION = {
  coordinates: [0, 20] as [number, number],
  zoom: 1.4,
};

const DEFAULT_ARGENTINA_POSITION = {
  coordinates: [-64.2, -38.9] as [number, number],
  zoom: 1.85,
};

const colorForCountry = (count: number, max: number) => {
  if (!count) return "#2D2E2E";
  if (max <= 0) return "#2D2E2E";
  const ratio = count / max;
  if (ratio > 0.66) return "#6A2F2F";
  if (ratio > 0.33) return "#4E3131";
  return "#3A2E2E";
};

export default function WorldLeadsMap({
  countryCounts,
  argentinaProvinceCounts = {},
  className,
}: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    detail: string;
  } | null>(null);
  const [position, setPosition] = useState(DEFAULT_WORLD_POSITION);
  const [zoneMode, setZoneMode] = useState<"soft" | "medium" | "strong">("medium");
  const [mapMode, setMapMode] = useState<"world" | "argentina">("world");

  const hasArgentinaProvinceData = useMemo(() => {
    return Object.values(argentinaProvinceCounts).some((count) => count > 0);
  }, [argentinaProvinceCounts]);

  useEffect(() => {
    if (mapMode === "argentina" && !hasArgentinaProvinceData) {
      setMapMode("world");
    }
  }, [mapMode, hasArgentinaProvinceData]);

  useEffect(() => {
    setPosition(mapMode === "argentina" ? DEFAULT_ARGENTINA_POSITION : DEFAULT_WORLD_POSITION);
  }, [mapMode]);

  const maxCountryCount = useMemo(() => {
    const values = Object.values(countryCounts);
    return values.length ? Math.max(...values) : 0;
  }, [countryCounts]);

  const maxProvinceCount = useMemo(() => {
    const values = Object.values(argentinaProvinceCounts);
    return values.length ? Math.max(...values) : 0;
  }, [argentinaProvinceCounts]);

  const zoneStyle = useMemo(() => {
    if (zoneMode === "soft") return { radius: { min: 5, max: 16 }, opacity: 0.2 };
    if (zoneMode === "strong") return { radius: { min: 9, max: 30 }, opacity: 0.34 };
    return { radius: { min: 7, max: 22 }, opacity: 0.27 };
  }, [zoneMode]);

  const markerLegendValues = useMemo(() => {
    const max = mapMode === "world" ? maxCountryCount : maxProvinceCount;
    if (max <= 0) return [] as number[];
    const mid = Math.max(1, Math.round(max / 2));
    return Array.from(new Set([1, mid, max])).sort((a, b) => a - b);
  }, [mapMode, maxCountryCount, maxProvinceCount]);

  const normalizedArgentinaProvinceCounts = useMemo(() => {
    const normalized: Record<string, number> = {};

    Object.entries(argentinaProvinceCounts).forEach(([rawName, count]) => {
      const key = normalizeKey(rawName);
      if (!key || count <= 0) return;
      const canonical = ARGENTINA_PROVINCE_NAME_OVERRIDES[key] || rawName;
      const normalizedCanonical = normalizeKey(canonical);
      normalized[normalizedCanonical] = (normalized[normalizedCanonical] || 0) + count;
    });

    return normalized;
  }, [argentinaProvinceCounts]);

  const countryNameToCode = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(COUNTRY_NAME_BY_CODE).forEach(([code, name]) => {
      map.set(name.toLowerCase(), code);
      (COUNTRY_NAME_ALIASES[code] || []).forEach((alias) => {
        map.set(alias.toLowerCase(), code);
      });
    });
    return map;
  }, []);

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: mapMode === "argentina" ? "360px" : "280px", background: "#191717" }}
    >
      <div style={{ position: "absolute", right: 8, top: 8, zIndex: 20, display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => setPosition((prev) => ({ ...prev, zoom: clamp(prev.zoom - 0.4, 1.2, 8) }))}
          style={{ border: "1px solid #3A3A3A", background: "#191717", color: "#FF5353", padding: "2px 6px", fontSize: 12 }}
          aria-label="Alejar"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => setPosition((prev) => ({ ...prev, zoom: clamp(prev.zoom + 0.4, 1.2, 8) }))}
          style={{ border: "1px solid #3A3A3A", background: "#191717", color: "#FF5353", padding: "2px 6px", fontSize: 12 }}
          aria-label="Acercar"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setPosition(mapMode === "argentina" ? DEFAULT_ARGENTINA_POSITION : DEFAULT_WORLD_POSITION)}
          style={{ border: "1px solid #3A3A3A", background: "#191717", color: "#FF5353", padding: "2px 6px", fontSize: 12 }}
          aria-label="Reset mapa"
        >
          1:1
        </button>
      </div>

      <div style={{ position: "absolute", left: 8, top: 8, zIndex: 20, display: "flex", gap: 4 }}>
        <button
          type="button"
          onClick={() => setMapMode("world")}
          style={{
            border: "1px solid #3A3A3A",
            background: "#191717",
            color: mapMode === "world" ? "#FF5353" : "#D0D0D0",
            padding: "2px 6px",
            fontSize: 10,
            textTransform: "uppercase",
          }}
        >
          Mundo
        </button>
        {hasArgentinaProvinceData ? (
          <button
            type="button"
            onClick={() => setMapMode("argentina")}
            style={{
              border: "1px solid #3A3A3A",
              background: "#191717",
              color: mapMode === "argentina" ? "#FF5353" : "#D0D0D0",
              padding: "2px 6px",
              fontSize: 10,
              textTransform: "uppercase",
            }}
          >
            Argentina
          </button>
        ) : null}
      </div>

      <div style={{ position: "absolute", left: 8, top: 36, zIndex: 20, display: "flex", gap: 4 }}>
        {(["soft", "medium", "strong"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setZoneMode(mode)}
            style={{
              border: "1px solid #3A3A3A",
              background: "#191717",
              color: zoneMode === mode ? "#FF5353" : "#D0D0D0",
              padding: "2px 6px",
              fontSize: 10,
              textTransform: "uppercase",
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={
          mapMode === "argentina"
            ? { scale: 900, center: [-64.2, -38.9] }
            : { scale: 145, center: [0, 20] }
        }
        style={{ width: "100%", height: "100%", background: "#191717" }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={mapMode === "argentina" ? 1.2 : 1.2}
          maxZoom={mapMode === "argentina" ? 10 : 8}
          onMoveEnd={({ coordinates, zoom }: { coordinates: [number, number]; zoom: number }) => {
            setPosition({
              coordinates: [clamp(coordinates[0], -180, 180), clamp(coordinates[1], -85, 85)],
              zoom: clamp(zoom, 1.2, mapMode === "argentina" ? 10 : 8),
            });
          }}
          translateExtent={[
            [-500, -300],
            [1200, 700],
          ]}
        >
          <Geographies geography={mapMode === "argentina" ? ARGENTINA_GEO_URL : GEO_URL}>
            {({ geographies }: { geographies: any[] }) => {
              const centroids = new Map<string, [number, number]>();

              const geoElements = geographies.map((geo: any) => {
                if (mapMode === "argentina") {
                  const provinceName = String(geo.properties?.shapeName || geo.properties?.name || "");
                  const provinceKey = normalizeKey(provinceName);
                  const count = normalizedArgentinaProvinceCounts[provinceKey] || 0;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: colorForCountry(count, maxProvinceCount),
                          stroke: "#3F3F3F",
                          strokeWidth: 0.9,
                          outline: "none",
                        },
                        hover: {
                          fill: colorForCountry(count, maxProvinceCount),
                          stroke: "#6B6B6B",
                          strokeWidth: 1.1,
                          outline: "none",
                        },
                        pressed: {
                          fill: colorForCountry(count, maxProvinceCount),
                          stroke: "#6B6B6B",
                          strokeWidth: 1.1,
                          outline: "none",
                        },
                      }}
                    />
                  );
                }

                const countryName = String(geo.properties?.name || geo.properties?.NAME || geo.properties?.name_en || "");
                const code = countryNameToCode.get(countryName.toLowerCase()) || "";
                const count = code ? countryCounts[code] || 0 : 0;

                if (code) {
                  const [lon, lat] = geoCentroid(geo) as [number, number];
                  if (Number.isFinite(lon) && Number.isFinite(lat)) {
                    centroids.set(code, [lon, lat]);
                  }
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{
                      default: {
                        fill: colorForCountry(count, maxCountryCount),
                        stroke: "#3A3A3A",
                        strokeWidth: 0.8,
                        outline: "none",
                      },
                      hover: {
                        fill: colorForCountry(count, maxCountryCount),
                        stroke: "#3A3A3A",
                        strokeWidth: 0.8,
                        outline: "none",
                      },
                      pressed: {
                        fill: colorForCountry(count, maxCountryCount),
                        stroke: "#3A3A3A",
                        strokeWidth: 0.8,
                        outline: "none",
                      },
                    }}
                  />
                );
              });

              const worldMarkers = Object.entries(countryCounts)
                .filter(([, count]) => count > 0)
                .map(([code, count]) => {
                  const coords = centroids.get(code);
                  if (!coords) return null;
                  const radius = buildProportionalRadius(count, maxCountryCount, zoneStyle.radius);
                  const label = COUNTRY_NAME_BY_CODE[code] || code;

                  return (
                    <Marker key={code} coordinates={coords}>
                      <circle
                        r={radius}
                        fill="#FF5353"
                        fillOpacity={zoneStyle.opacity}
                        stroke="#FF8D8D"
                        strokeWidth={0.8}
                      />
                      <circle
                        r={2.4}
                        fill="#FF5353"
                        fillOpacity={0.96}
                        stroke="#FFF0F0"
                        strokeWidth={0.9}
                        onMouseMove={(event) => {
                          setTooltip({
                            x: event.clientX,
                            y: event.clientY,
                            title: `${formatCount(count)} leads`,
                            detail: label,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    </Marker>
                  );
                });

              const provinceMarkers = Object.entries(argentinaProvinceCounts)
                .filter(([, count]) => count > 0)
                .map(([province, count]) => {
                  const coords = ARGENTINA_PROVINCE_COORDS[province];
                  if (!coords) return null;
                  const radius = buildProportionalRadius(count, maxProvinceCount, zoneStyle.radius);

                  return (
                    <Marker key={province} coordinates={coords}>
                      <circle
                        r={radius}
                        fill="#FF5353"
                        fillOpacity={zoneStyle.opacity}
                        stroke="#FF8D8D"
                        strokeWidth={0.8}
                      />
                      <circle
                        r={2.4}
                        fill="#FF5353"
                        fillOpacity={0.96}
                        stroke="#FFF0F0"
                        strokeWidth={0.9}
                        onMouseMove={(event) => {
                          setTooltip({
                            x: event.clientX,
                            y: event.clientY,
                            title: `${formatCount(count)} leads`,
                            detail: province,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    </Marker>
                  );
                });

              return (
                <>
                  {geoElements}
                  {mapMode === "world" ? worldMarkers : provinceMarkers}
                </>
              );
            }}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip ? (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            border: "1px solid #3A3A3A",
            background: "#191717",
            color: "#fff",
            padding: "6px 8px",
            fontSize: 12,
            lineHeight: 1.35,
            pointerEvents: "none",
            zIndex: 60,
          }}
        >
          <div style={{ fontWeight: 600 }}>{tooltip.title}</div>
          <div>{tooltip.detail}</div>
        </div>
      ) : null}

      {markerLegendValues.length ? (
        <div
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            zIndex: 20,
            border: "1px solid #3A3A3A",
            background: "rgba(25, 23, 23, 0.9)",
            color: "#EAEAEA",
            padding: "6px 8px",
            fontSize: 10,
            lineHeight: 1.35,
            minWidth: 84,
          }}
        >
          {markerLegendValues.map((value) => {
            const max = mapMode === "world" ? maxCountryCount : maxProvinceCount;
            const radius = buildProportionalRadius(value, max, zoneStyle.radius);
            return (
              <div key={value} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    width: Math.max(6, radius),
                    height: Math.max(6, radius),
                    borderRadius: "999px",
                    background: "#FF5353",
                    opacity: zoneStyle.opacity,
                    border: "1px solid #FF8D8D",
                    display: "inline-block",
                  }}
                />
                <span>{formatCount(value)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
