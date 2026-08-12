import { useEffect, useRef, useState } from "react";

import type { OriginPlace } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";
import { AppIcon } from "../../shared/ui/AppIcon";

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
  const [resultsOpen, setResultsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected) setQuery(selected.name);
  }, [selected]);

  useEffect(() => {
    if (!resultsOpen) return;
    searchInputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setResultsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [resultsOpen]);

  useEffect(() => {
    if (!resultsOpen) return;
    const normalized = query.trim();
    if (normalized.length < 2 || selected?.name === normalized) {
      setPlaces([]);
      setSearching(false);
      setSearchError("");
      return;
    }
    let active = true;
    setSearching(true);
    setResultsOpen(true);
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
  }, [searchPath, query, selected, resultsOpen]);

  function openSearch() {
    setQuery(selected?.name ?? "");
    setPlaces([]);
    setSearchError("");
    setResultsOpen(true);
  }

  function changeQuery(value: string) {
    setQuery(value);
  }

  return <div className="place-field">
    <span className="field-label" id={`${id}-label`}>{label}</span>
    <button
      className={selected ? "place-trigger selected" : "place-trigger"}
      type="button"
      aria-labelledby={`${id}-label ${id}-trigger-copy`}
      aria-describedby={`${id}-help`}
      aria-haspopup="dialog"
      onClick={openSearch}
    >
      <span className="place-trigger-icon"><AppIcon name={selected ? "map" : "search"} /></span>
      <span id={`${id}-trigger-copy`} className="place-trigger-copy">
        {selected ? <><strong>{selected.name}</strong><small>{selected.address || selected.category}</small></> : <strong>역, 학교, 건물, 공공장소 검색</strong>}
      </span>
      <AppIcon name="chevron" size={18} />
    </button>
    <p id={`${id}-help`} className="note">{help}</p>
    <div id={`${id}-status`} className="place-status" aria-live="polite">
      {selected && <p className="selection-confirmed"><span className="selected-check">✓</span>장소가 선택됐어요. 눌러서 변경할 수 있어요.</p>}
    </div>
    {resultsOpen && <div className="sheet-layer place-sheet-layer">
      <button className="sheet-scrim" type="button" aria-label="장소 검색 결과 닫기" onClick={() => setResultsOpen(false)} />
      <section className="bottom-sheet place-sheet mobile-search-sheet" role="dialog" aria-modal="true" aria-labelledby={`${id}-results-title`}>
        <div className="sheet-handle" />
        <div className="sheet-header place-search-header"><div><p>장소 검색</p><h2 id={`${id}-results-title`}>{label}</h2></div><button className="icon-button" type="button" aria-label="닫기" onClick={() => setResultsOpen(false)}><AppIcon name="close" /></button></div>
        <div className="input-with-icon sheet-search-input"><AppIcon name="search" /><input
          ref={searchInputRef}
          id={id}
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          maxLength={50}
          placeholder="역, 학교, 건물, 공공장소 검색"
          autoFocus
          autoComplete="off"
          enterKeyHint="search"
          aria-label={`${label} 검색어`}
        />{query && <button type="button" aria-label="검색어 지우기" onClick={() => changeQuery("")}><AppIcon name="close" size={16} /></button>}</div>
        {query.trim().length < 2 && <div className="search-guide"><span><AppIcon name="map" /></span><strong>가까운 공개 장소를 검색해 주세요</strong><p>정확한 집 주소 대신 역·학교·건물 이름을 입력하면 개인정보를 덜 남길 수 있어요.</p></div>}
        {searching && <div className="searching-state"><span /><p>카카오맵에서 찾고 있어요</p></div>}
        {!searching && searchError && <p className="sheet-empty">{searchError}</p>}
        {!searching && places.length > 0 && <ul className="place-results" aria-label={`${label} 검색 결과`}>
          {places.map((place) => <li key={place.id}>
            <button type="button" onClick={() => { onSelect(place); setQuery(place.name); setPlaces([]); setResultsOpen(false); }}>
              <span className="place-result-icon"><AppIcon name="map" /></span><span className="place-result-copy"><strong>{place.name}</strong><span>{place.address || "주소 정보 없음"}</span><small>{place.category}</small></span><AppIcon name="chevron" />
            </button>
          </li>)}
        </ul>}
      </section>
    </div>}
  </div>;
}
