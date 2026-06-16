import type { RestaurantSummary } from "@/lib/types";

// Giá VND -> "45k" / "1.2tr" gọn cho chip.
export function fmtVnd(p: number): string {
  return p >= 1_000_000
    ? `${(p / 1_000_000).toFixed(p % 1_000_000 ? 1 : 0)}tr`
    : p >= 1000
      ? `${Math.round(p / 1000)}k`
      : `${p}`;
}

export default function RestaurantCard({
  restaurant,
  onClick,
}: {
  restaurant: RestaurantSummary;
  onClick: () => void;
}) {
  const tags = restaurant.tags ?? [];
  const matchedDishes = restaurant.matchedDishes ?? [];
  const distanceKm =
    restaurant.distanceM != null
      ? (restaurant.distanceM / 1000).toFixed(1)
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
          {restaurant.name}
        </h3>
        {restaurant.rating && (
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-sm font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <span className="text-amber-500">★</span>
            {restaurant.rating}
            {restaurant.ratingCount != null && (
              <span className="font-normal text-amber-600/70">
                ({restaurant.ratingCount})
              </span>
            )}
          </span>
        )}
      </div>

      {restaurant.address && (
        <p className="mt-1 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
          {restaurant.address}
        </p>
      )}

      {distanceKm && (
        <p className="mt-1 flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="text-zinc-400">📍</span>
          cách {distanceKm} km
        </p>
      )}

      {/* Nhánh tìm theo món: hiện món của quán khớp với món user hỏi (kèm giá) */}
      {matchedDishes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {matchedDishes.map((d) => {
            const price = d.price != null ? fmtVnd(d.price) : null;
            return (
              <span
                key={d.name}
                className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300"
              >
                {d.name}
                {price && <span className="text-green-600/70"> · {price}</span>}
              </span>
            );
          })}
        </div>
      ) : (
        tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-950 dark:text-orange-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )
      )}
    </button>
  );
}
