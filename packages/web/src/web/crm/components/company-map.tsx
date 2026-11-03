import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { point, areaName } from "../lib/intelligence";
import { type Row } from "../lib/crm";
export function CompanyMap({
  companies,
  draft,
  onSelect,
}: {
  companies: Row[];
  draft: Row[];
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null);
  const [basemap, setBasemap] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, { attributionControl: true }).setView([26.8, 30.8], 5);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const layer = L.layerGroup().addTo(m);
    const located = companies.filter((c) => point(c));
    for (const c of located) {
      const p = point(c)!;
      const selected = draft.some((d) => d.id === c.id);
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: selected ? 11 : 8,
        color: selected ? "#ff9b54" : "#8cd6ff",
        fillColor: selected ? "#ff9b54" : "#8cd6ff",
        fillOpacity: 0.8,
        weight: 2,
      }).addTo(layer);
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = c.data.name;
      content.append(title);
      const info = document.createElement("p");
      info.textContent = [
        areaName(c),
        c.data.address,
        c.data.phone,
        c.data.status,
        `أولوية ${c.data.priority}`,
        c.data.opensAt && `العمل ${c.data.opensAt} — ${c.data.closesAt || "غير مسجل"}`,
      ]
        .filter(Boolean)
        .join(" · ");
      content.append(info);
      const button = document.createElement("button");
      button.textContent = selected ? "استبعاد من المسودة" : "أضف إلى المسودة";
      button.onclick = () => onSelect(c.id);
      content.append(button);
      marker.bindPopup(content);
    }
    const points = draft.map(point).filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (points.length > 1)
      L.polyline(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#ff9b54", dashArray: "7 8", weight: 2 },
      ).addTo(layer);
    if (located.length)
      m.fitBounds(
        L.latLngBounds(
          located.map((c) => {
            const p = point(c)!;
            return [p.lat, p.lng] as [number, number];
          }),
        ),
        { padding: [30, 30], maxZoom: 14 },
      );
    return () => {
      m.removeLayer(layer);
    };
  }, [companies, draft, onSelect]);
  useEffect(() => {
    const m = map.current;
    if (!m || !basemap) return;
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(m);
    return () => {
      m.removeLayer(tiles);
    };
  }, [basemap]);
  return (
    <section className="panel map-panel">
      <div className="section-heading">
        <div>
          <h3>خريطة الشركات المسجلة</h3>
          <p className="help">
            النقاط لإحداثيات أدخلتها أنت فقط. الخط المتقطع ترتيب مقترح، وليس طريق قيادة.
          </p>
        </div>
        <label className="check">
          <input
            aria-label="تفعيل خلفية OpenStreetMap الخارجية"
            type="checkbox"
            checked={basemap}
            onChange={(e) => setBasemap(e.target.checked)}
          />{" "}
          خلفية OpenStreetMap
        </label>
      </div>
      <div className="company-map" ref={host} aria-label="خريطة تفاعلية للشركات" />
      <p className="help">
        {companies.filter((c) => point(c)).length} موقع مؤكد من {companies.length} شركة. الخلفية
        اختيارية وترسل عنوان الإنترنت ونطاق العرض لمزود الخرائط، لا بيانات الشركات. خدمة عامة بلا ضمان
        توافر.
      </p>
    </section>
  );
}
