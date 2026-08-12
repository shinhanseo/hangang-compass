import { useEffect, useState } from "react";

import type { OriginPlace } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";

export function PlaceSearchField({ searchPath, id, label, help, selected, onSelect }: {
  searchPath: string;
  id: string;
  label: string;
  help: string;
  selected: OriginPlace | null;
  onSelect: (place: OriginPlace | null) => void;
}) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [places, setPlaces] = useState<OriginPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (selected) setQuery(selected.name);
  }, [selected]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2 || selected?.name === normalized) {
      setPlaces([]);
      setSearching(false);
      setSearchError("");
      return;
    }
    let active = true;
    setSearching(true);
    setSearchError("");
    const timeout = window.setTimeout(() => {
      api<{ places: OriginPlace[] }>(`${searchPath}?query=${encodeURIComponent(normalized)}`)
        .then((result) => {
          if (!active) return;
          setPlaces(result.places);
          setSearchError(result.places.length ? "" : "검색 결과가 없어요. 장소 이름을 더 구체적으로 입력해 주세요.");
        })
        .catch(() => active && setSearchError("장소 검색을 잠시 사용할 수 없어요. 조금 뒤 다시 시도해 주세요."))
        .finally(() => active && setSearching(false));
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [searchPath, query, selected]);

  return <div className="place-field">
    <label htmlFor={id}>{label}</label>
    <input
      id={id}
      value={query}
      onChange={(event) => {
        setQuery(event.target.value);
        if (selected?.name !== event.target.value) onSelect(null);
      }}
      maxLength={50}
      placeholder="역, 학교, 건물, 공공장소 검색"
      autoComplete="off"
      aria-describedby={`${id}-help ${id}-status`}
      required
    />
    <p id={`${id}-help`} className="note">{help}</p>
    <div id={`${id}-status`} className="place-status" aria-live="polite">
      {searching && <p className="note">카카오맵에서 장소를 찾는 중…</p>}
      {searchError && <p className="error">{searchError}</p>}
      {selected && <p className="selected-place"><strong>{selected.name}</strong><span>{selected.address || selected.category}</span></p>}
    </div>
    {!selected && places.length > 0 && <ul className="place-results" aria-label={`${label} 검색 결과`}>
      {places.map((place) => <li key={place.id}>
        <button type="button" onClick={() => { onSelect(place); setQuery(place.name); setPlaces([]); }}>
          <strong>{place.name}</strong><span>{place.address || "주소 정보 없음"}</span><small>{place.category}</small>
        </button>
      </li>)}
    </ul>}
  </div>;
}
