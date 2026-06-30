// Trang thông tin người mua (plan 14): lưu sẵn SĐT + địa chỉ (kèm toạ độ) để prefill form đặt món.
// "use client" — có state + fetch + geocode. Tái dùng pattern "Kiểm tra địa chỉ" của OrderForm.

"use client";

import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import type { LatLng } from "@/lib/types";
import type { BuyerProfile } from "@/lib/profile/repo";

const PHONE_RE = /^0\d{9}$/;

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand";
const errClass = "mt-1 text-xs text-brand";

export default function ProfilePage() {
  const [loaded, setLoaded] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  // Toạ độ lưu kèm địa chỉ (để prefill mang sẵn gate bán kính). Nguồn: từ địa chỉ text
  // (geocode) hoặc vị trí hiện tại (GPS). Bấm nút nào sau thì toạ độ đó thắng.
  const [geo, setGeo] = useState<LatLng | null>(null);
  const [geoSource, setGeoSource] = useState<"address" | "current" | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [locating, setLocating] = useState(false);

  // Trạng thái lưu.
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { profile: BuyerProfile } | null) => {
        const p = d?.profile;
        if (p) {
          setPhone(p.phone ?? "");
          setAddress(p.address ?? "");
          if (p.lat != null && p.lng != null) setGeo({ lat: p.lat, lng: p.lng });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Đổi địa chỉ text → toạ độ suy ra từ text không còn đúng, reset. Giữ toạ độ GPS (vị trí
  // hiện tại) vì nó độc lập với text.
  const onAddressChange = (value: string) => {
    setAddress(value);
    if (geoSource !== "current") {
      setGeo(null);
      setGeoSource(null);
    }
    setGeoErr(null);
    setSaved(false);
  };

  // Lấy toạ độ TỪ ĐỊA CHỈ TEXT qua geocode.
  const checkAddress = async () => {
    const q = address.trim();
    if (!q) return;
    setChecking(true);
    setGeoErr(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setGeoErr(data?.error ?? "Không kiểm tra được địa chỉ.");
        return;
      }
      setGeo((await res.json()) as LatLng);
      setGeoSource("address");
      setSaved(false);
    } catch {
      setGeoErr("Lỗi mạng khi kiểm tra địa chỉ.");
    } finally {
      setChecking(false);
    }
  };

  // Lấy toạ độ TỪ VỊ TRÍ HIỆN TẠI qua trình duyệt (GPS).
  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoErr("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    setLocating(true);
    setGeoErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoSource("current");
        setSaved(false);
        setLocating(false);
      },
      (err) => {
        setGeoErr(
          err.code === err.PERMISSION_DENIED
            ? "Bạn đã từ chối quyền vị trí."
            : "Không lấy được vị trí hiện tại.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  };

  const phoneError = phone.trim() !== "" && !PHONE_RE.test(phone.trim());

  const save = async () => {
    if (phoneError) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSaved(false);
    setSaveErr(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim() || null,
          address: address.trim() || null,
          lat: address.trim() ? (geo?.lat ?? null) : null,
          lng: address.trim() ? (geo?.lng ?? null) : null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setSaveErr(data?.error ?? "Không lưu được thông tin.");
        return;
      }
      setSaved(true);
    } catch {
      setSaveErr("Lỗi mạng khi lưu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <SiteHeader />
      <h1 className="mb-2 text-xl font-bold text-foreground">Thông tin của tôi</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Lưu sẵn số điện thoại và địa chỉ giao để điền nhanh khi đặt món (vẫn sửa được lúc đặt).
      </p>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : (
        <div className="flex flex-col gap-5">
          {/* SĐT */}
          <section>
            <label className="mb-1 block text-sm font-semibold text-foreground">
              Số điện thoại
            </label>
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setSaved(false);
              }}
              inputMode="numeric"
              placeholder="0901234567"
              className={inputClass}
            />
            {showErrors && phoneError && (
              <p className={errClass}>Số điện thoại không hợp lệ (10 số, bắt đầu 0).</p>
            )}
          </section>

          {/* Địa chỉ */}
          <section>
            <label className="mb-1 block text-sm font-semibold text-foreground">
              Địa chỉ giao
            </label>
            <input
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="Số nhà, đường, phường…"
              className={inputClass}
            />
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={checkAddress}
                  disabled={checking || address.trim() === ""}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checking ? "Đang kiểm tra…" : "Kiểm tra địa chỉ"}
                </button>
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locating}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {locating ? "Đang lấy vị trí…" : "📍 Dùng vị trí hiện tại"}
                </button>
              </div>
              {geoErr && <p className={errClass}>{geoErr}</p>}
              {geo && (
                <p className="text-xs text-success">
                  ✓ Đã có toạ độ{" "}
                  {geoSource === "current"
                    ? "(vị trí hiện tại)"
                    : geoSource === "address"
                      ? "(từ địa chỉ)"
                      : ""}{" "}
                  ·{" "}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline"
                  >
                    Mở trên Google Maps ↗
                  </a>
                </p>
              )}
            </div>
          </section>

          {/* Lưu */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
            {saved && <span className="text-sm text-success">✓ Đã lưu</span>}
            {saveErr && <span className="text-sm text-brand">{saveErr}</span>}
          </div>
        </div>
      )}
    </main>
  );
}
