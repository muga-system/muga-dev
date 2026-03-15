import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { geoCentroid } from "d3-geo";

type WorldLeadsMapProps = {
  countryCounts: Record<string, number>;
  className?: string;
};

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const DEFAULT_POSITION = {
  coordinates: [0, 20] as [number, number],
  zoom: 1.4,
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
  className,
}: WorldLeadsMapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    email: string;
    country: string;
  } | null>(null);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [zoneMode, setZoneMode] = useState<"soft" | "medium" | "strong">("medium");

  const maxCount = useMemo(() => {
    const values = Object.values(countryCounts);
    return values.length ? Math.max(...values) : 0;
  }, [countryCounts]);

  const zoneStyle = useMemo(() => {
    if (zoneMode === "soft") return { radiusBoost: 3, opacity: 0.14 };
    if (zoneMode === "strong") return { radiusBoost: 8, opacity: 0.3 };
    return { radiusBoost: 5, opacity: 0.22 };
  }, [zoneMode]);

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

  const highlightedCountryNames = useMemo(() => {
    return Object.entries(countryCounts)
      .filter(([, count]) => count > 0)
      .map(([code]) => COUNTRY_NAME_BY_CODE[code] || "")
      .filter(Boolean);
  }, [countryCounts]);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "260px", background: "#191717" }}>
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
          onClick={() => setPosition(DEFAULT_POSITION)}
          style={{ border: "1px solid #3A3A3A", background: "#191717", color: "#FF5353", padding: "2px 6px", fontSize: 12 }}
          aria-label="Reset mapa"
        >
          1:1
        </button>
      </div>

      <div style={{ position: "absolute", left: 8, top: 8, zIndex: 20, display: "flex", gap: 4 }}>
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
        projectionConfig={{ scale: 145, center: [0, 20] }}
        style={{ width: "100%", height: "100%", background: "#191717" }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={1.2}
          maxZoom={8}
          onMoveEnd={({ coordinates, zoom }) => {
            setPosition({
              coordinates: [clamp(coordinates[0], -180, 180), clamp(coordinates[1], -85, 85)],
              zoom: clamp(zoom, 1.2, 8),
            });
          }}
          translateExtent={[
            [-500, -300],
            [1200, 700],
          ]}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) => {
              const centroids = new Map<string, [number, number]>();

              const geoElements = geographies.map((geo) => {
                const countryName = String(
                  geo.properties?.name || geo.properties?.NAME || geo.properties?.name_en || "",
                );
                const code = countryNameToCode.get(countryName.toLowerCase()) || "";
                const count = code ? countryCounts[code] || 0 : 0;
                const isHighlighted = highlightedCountryNames.includes(countryName);

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
                        fill: colorForCountry(count, maxCount),
                        stroke: "#3A3A3A",
                        strokeWidth: isHighlighted ? 1.2 : 0.8,
                        outline: "none",
                      },
                      hover: {
                        fill: colorForCountry(count, maxCount),
                        stroke: "#3A3A3A",
                        strokeWidth: isHighlighted ? 1.2 : 0.8,
                        outline: "none",
                      },
                      pressed: {
                        fill: colorForCountry(count, maxCount),
                        stroke: "#3A3A3A",
                        strokeWidth: isHighlighted ? 1.2 : 0.8,
                        outline: "none",
                      },
                    }}
                  />
                );
              });

              const markerElements = Object.entries(countryCounts)
                .filter(([, count]) => count > 0)
                .map(([code, count]) => {
                  const coords = centroids.get(code);
                  if (!coords) return null;

                  return (
                    <Marker key={code} coordinates={coords}>
                      <circle
                        r={Math.max(7, Math.min(18, 6 + count / 2 + zoneStyle.radiusBoost))}
                        fill="#FF5353"
                        fillOpacity={zoneStyle.opacity}
                        stroke="none"
                        pointerEvents="none"
                      />
                      <circle
                        r={4}
                        fill="#FF5353"
                        fillOpacity={0.9}
                        stroke="none"
                        onMouseMove={(event) => {
                          setTooltip({
                            x: event.clientX,
                            y: event.clientY,
                            email: `${count} leads`,
                            country: code,
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
                  {markerElements}
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
          <div style={{ fontWeight: 600 }}>{tooltip.email}</div>
          <div>{tooltip.country}</div>
        </div>
      ) : null}
    </div>
  );
}
