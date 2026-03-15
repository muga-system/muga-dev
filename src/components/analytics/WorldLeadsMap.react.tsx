import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

type LeadPoint = {
  lon: number;
  lat: number;
  email: string;
  country?: string;
};

type WorldLeadsMapProps = {
  countryCounts: Record<string, number>;
  leadPoints: LeadPoint[];
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
  leadPoints,
  className,
}: WorldLeadsMapProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    email: string;
    country: string;
  } | null>(null);

  const maxCount = useMemo(() => {
    const values = Object.values(countryCounts);
    return values.length ? Math.max(...values) : 0;
  }, [countryCounts]);

  const highlightedCountryNames = useMemo(() => {
    return Object.entries(countryCounts)
      .filter(([, count]) => count > 0)
      .map(([code]) => COUNTRY_NAME_BY_CODE[code] || "")
      .filter(Boolean);
  }, [countryCounts]);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "260px", background: "#191717" }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 145, center: [0, 20] }}
        style={{ width: "100%", height: "100%", background: "#191717" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const countryName = String(
                geo.properties?.name || geo.properties?.NAME || geo.properties?.name_en || "",
              );
              const code = Object.keys(COUNTRY_NAME_BY_CODE).find(
                (item) => COUNTRY_NAME_BY_CODE[item] === countryName,
              );
              const count = code ? countryCounts[code] || 0 : 0;
              const isHighlighted = highlightedCountryNames.includes(countryName);

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
            })
          }
        </Geographies>

        {leadPoints.map((lead, index) => (
          <Marker key={`${lead.email}-${index}`} coordinates={[lead.lon, lead.lat]}>
            <circle
              r={8}
              fill="#FF5353"
              fillOpacity={0.18}
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
                  email: lead.email,
                  country: lead.country || "-",
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          </Marker>
        ))}
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
