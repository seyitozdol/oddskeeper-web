import csv
import json
import logging
import re
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait



PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data" / "raw" / "opta_unified_matches"
CSV_PATH = PROJECT_ROOT / "matches26.csv"

TARGET_SEASON_TOKEN = "2025-2026"
HEADLESS = False
KEEP_BROWSER_OPEN = True
PAGE_WAIT_SECONDS = 12

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def element_text(element) -> str:
    try:
        return (element.text or "").strip()
    except Exception:
        return ""


def safe_find_text(root, by, selector, default="") -> str:
    try:
        return element_text(root.find_element(by, selector))
    except Exception:
        return default


def parse_int(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    text = text.replace(",", "").replace("’", "").replace("'", "")
    m = re.search(r"-?\d+", text)
    if not m:
        return None
    try:
        return int(m.group())
    except Exception:
        return None


def parse_float(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    text = text.replace("\xa0", " ").strip().replace(",", ".")
    m = re.search(r"-?\d+(?:\.\d+)?", text)
    if not m:
        return None
    try:
        return float(m.group())
    except Exception:
        return None


def coerce_value(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return ""
    if re.fullmatch(r"-?\d+", text.replace(",", "")):
        return parse_int(text)
    if re.fullmatch(r"-?\d+[.,]\d+", text):
        return parse_float(text)
    return text


def extract_id_from_class(class_text: str, prefix: str):
    if not class_text:
        return None
    m = re.search(re.escape(prefix) + r"([A-Za-z0-9_-]+)", class_text)
    return m.group(1) if m else None


def slugify_label(label: str) -> str:
    text = (label or "").strip()
    if not text:
        return ""
    replacements = {
        "Pos.": "position",
        "Rank": "rank",
        "PTS": "points",
        "MP": "minutes_played",
        "G": "goals",
        "SOnT": "shots_on_target",
        "SOffT": "shots_off_target",
        "BS": "shots_blocked",
        "OG": "own_goals",
        "A": "assists",
        "P": "passes",
        "C": "crosses",
        "Tk": "tackles",
        "INT": "interceptions",
        "FW": "fouls_won",
        "FC": "fouls_conceded",
        "O": "offsides",
        "YC": "cards_yellow",
        "RC": "cards_red",
        "GC": "goals_conceded",
        "PW": "penalties_won",
        "SAV": "saves_total",
        "PSAV": "penalties_saved",
        "S": "shots_total",
        "Crn": "corners",
        "AP": "ap",
        "HW": "hw",
        "SIB": "shots_inside_box",
        "SOB": "shots_outside_box",
        "HS": "headed_shots",
        "xG": "xg",
        "GK": "goal_kicks",
        "Ti": "throw_ins",
        "GOTB": "ground_duels_won",
        "RFG": "right_foot_goals",
        "LFG": "left_foot_goals",
        "HG": "headed_goals",
        "PG": "penalty_goals",
        "GFSP": "goals_from_set_piece",
        "FaA": "fouls_against",
    }
    if text in replacements:
        return replacements[text]
    text = text.lower()
    text = text.replace("%", " pct ")
    text = re.sub(r"[^a-z0-9çğıöşü]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "col"


def normalize_match_urls(input_url: str) -> dict:
    clean = input_url.strip().split("?")[0].rstrip("/")
    m = re.search(r"/match/view/([^/]+)", clean)
    if not m:
        raise ValueError("Match ID URL içinde bulunamadı.")
    source_match_id = m.group(1)
    season_match = re.search(r"/soccer/([^/]+)/", clean)
    source_season_slug = season_match.group(1) if season_match else ""
    base_url = clean
    for suffix in ["/match-summary", "/opta-points", "/match-details"]:
        if base_url.endswith(suffix):
            base_url = base_url[: -len(suffix)]
    return {
        "source_match_id": source_match_id,
        "source_season_slug": source_season_slug,
        "base_url": base_url,
        "match_summary_url": base_url + "/match-summary",
        "opta_points_url": base_url + "/opta-points",
        "match_details_url": base_url + "/match-details",
    }


def build_page_result(status, page_type, url, data=None, reason="", error_message=""):
    return {
        "status": status,
        "page_type": page_type,
        "url": url,
        "data": data,
        "reason": reason,
        "error_message": error_message,
    }


def setup_driver():
    options = Options()
    if HEADLESS:
        options.add_argument("--headless=new")
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-notifications")
    options.add_argument("--log-level=3")

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(60)
    return driver


def click_shadow_cookie_button(driver):
    script = '''
    const hosts = Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot);
    for (const host of hosts) {
        const root = host.shadowRoot;
        const selectors = ['#accept','button#accept','button[mode="primary"]'];
        for (const sel of selectors) {
            const btn = root.querySelector(sel);
            if (btn) {
                btn.click();
                return {clicked: true};
            }
        }
        const buttons = Array.from(root.querySelectorAll('button'));
        for (const btn of buttons) {
            const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            if (txt.includes('accept') || txt.includes('allow all')) {
                btn.click();
                return {clicked: true};
            }
        }
    }
    return {clicked: false};
    '''
    try:
        return driver.execute_script(script)
    except Exception:
        return {"clicked": False}


def accept_cookies_once(driver, cookie_state: dict):
    if cookie_state.get("done"):
        return
    time.sleep(2)
    try:
        try:
            btn = WebDriverWait(driver, 3).until(EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler")))
            btn.click()
            cookie_state["done"] = True
            logging.info("Çerez kabul edildi (legacy button).")
            return
        except Exception:
            pass
        try:
            btn = WebDriverWait(driver, 3).until(EC.element_to_be_clickable((By.XPATH, '//*[@id="accept"]')))
            btn.click()
            cookie_state["done"] = True
            logging.info("Çerez kabul edildi (#accept).")
            return
        except Exception:
            pass
        result = click_shadow_cookie_button(driver)
        if result.get("clicked"):
            cookie_state["done"] = True
            logging.info("Çerez kabul edildi (shadow DOM).")
            return
        logging.info("Çerez popup bulunamadı veya zaten kapalı.")
        cookie_state["done"] = True
    except Exception:
        logging.info("Çerez popup atlandı.")
        cookie_state["done"] = True


def wait_for_page(driver):
    WebDriverWait(driver, PAGE_WAIT_SECONDS).until(lambda d: d.execute_script("return document.readyState") == "complete")
    time.sleep(1.5)


def wait_for_current_layout(driver, timeout=6) -> bool:
    try:
        WebDriverWait(driver, timeout).until(lambda d: len(d.find_elements(By.ID, "opta-player-stats-container")) > 0)
        return True
    except Exception:
        return False


def current_layout_present(driver) -> bool:
    if driver.find_elements(By.ID, "Opta_0"):
        return True
    if driver.find_elements(By.CSS_SELECTOR, "playerstats-match"):
        return True
    if driver.find_elements(By.CSS_SELECTOR, "#opta-player-stats-container ul.Opta-Cf"):
        return True
    return False


def extract_match_info(driver, page_type: str):
    current_url = driver.current_url
    match_id_match = re.search(r"/match/view/([^/]+)", current_url)
    source_match_id = match_id_match.group(1) if match_id_match else "unknown_match"

    team_name_cells = driver.find_elements(By.CSS_SELECTOR, "td.Opta-TeamName")
    score_spans = driver.find_elements(By.CSS_SELECTOR, "span.Opta-Team-Score")

    home_team_name = element_text(team_name_cells[0]) if len(team_name_cells) >= 1 else ""
    away_team_name = element_text(team_name_cells[1]) if len(team_name_cells) >= 2 else ""

    home_team_source_id = extract_id_from_class(team_name_cells[0].get_attribute("class") if len(team_name_cells) >= 1 else "", "Opta-Team-")
    away_team_source_id = extract_id_from_class(team_name_cells[1].get_attribute("class") if len(team_name_cells) >= 2 else "", "Opta-Team-")

    home_score = parse_int(element_text(score_spans[0])) if len(score_spans) >= 1 else None
    away_score = parse_int(element_text(score_spans[1])) if len(score_spans) >= 2 else None

    competition = safe_find_text(driver, By.CSS_SELECTOR, "span.Opta-Competition")
    match_date_text = safe_find_text(driver, By.CSS_SELECTOR, "span.Opta-Date")

    venue = ""
    attendance_text = ""
    referee = ""

    dl_rows = driver.find_elements(By.CSS_SELECTOR, "div.Opta-Matchdata dl")
    for dl in dl_rows:
        key = safe_find_text(dl, By.TAG_NAME, "dt").lower()
        value = safe_find_text(dl, By.TAG_NAME, "dd")
        if key == "venue":
            venue = value
        elif key == "attendance":
            attendance_text = value
        elif key == "referee":
            referee = value

    winner_team_source_id = None
    winner_side = None
    if home_score is not None and away_score is not None:
        if home_score > away_score:
            winner_team_source_id = home_team_source_id
            winner_side = "home"
        elif away_score > home_score:
            winner_team_source_id = away_team_source_id
            winner_side = "away"

    return {
        "source": "opta",
        "page_type": page_type,
        "match_url": current_url,
        "page_title": driver.title,
        "source_match_id": source_match_id,
        "raw_match_date_ms": "",
        "competition": competition,
        "match_date_text": match_date_text,
        "winner_team_source_id": winner_team_source_id,
        "winner_side": winner_side,
        "home_team": {
            "name": home_team_name,
            "source_team_id": home_team_source_id,
            "score": home_score,
        },
        "away_team": {
            "name": away_team_name,
            "source_team_id": away_team_source_id,
            "score": away_score,
        },
        "venue": venue,
        "attendance_text": attendance_text,
        "attendance": parse_int(attendance_text),
        "referee": referee,
    }


def get_visible_main_table(driver):
    tables = driver.find_elements(By.CSS_SELECTOR, "#opta-player-stats-container table.Opta-Striped")
    candidates = []
    for table in tables:
        if not table.is_displayed():
            continue
        headers = table.find_elements(By.CSS_SELECTOR, "thead th")
        rows = table.find_elements(By.CSS_SELECTOR, "tbody tr")
        if len(headers) == 0 or len(rows) == 0:
            continue
        score = (len(headers) * 1000) + len(rows)
        candidates.append((score, table))
    if not candidates:
        raise ValueError("Görünür ana tablo bulunamadı.")
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def extract_lineup_status_from_row(row):
    try:
        startpos = row.find_element(By.CSS_SELECTOR, "span.startpos")
        klass = (startpos.get_attribute("class") or "").lower()
        if "starter" in klass:
            return "starter"
        if "sub" in klass:
            return "substitute"
    except Exception:
        pass
    return None


def parse_generic_table(table):
    header_elements = table.find_elements(By.CSS_SELECTOR, "thead th")
    raw_headers = [element_text(x) for x in header_elements]

    headers = [{"key": "player_name", "label": "Player Name"}]
    for raw in raw_headers[1:]:
        label = raw.strip() if raw.strip() else "Value"
        headers.append({"key": slugify_label(label), "label": label})

    rows = []
    totals = None

    body_rows = table.find_elements(By.CSS_SELECTOR, "tbody tr")
    for row in body_rows:
        row_class = (row.get_attribute("class") or "").lower()
        th_cells = row.find_elements(By.CSS_SELECTOR, "th")
        td_cells = row.find_elements(By.CSS_SELECTOR, "td")
        if not th_cells and not td_cells:
            continue

        player_name = element_text(th_cells[0]) if th_cells else ""
        if not player_name and td_cells:
            player_name = element_text(td_cells[0])
        if not player_name:
            continue

        player_source_id = None
        if th_cells:
            player_source_id = extract_id_from_class(th_cells[0].get_attribute("class") or "", "Opta-Player-")

        player_side = None
        if "side-home" in row_class:
            player_side = "home"
        elif "side-away" in row_class:
            player_side = "away"

        lineup_status = extract_lineup_status_from_row(row)

        values = [element_text(td) for td in td_cells]
        if len(values) == len(headers):
            values = values[1:]

        stats = {}
        for idx, hdr in enumerate(headers[1:]):
            val = values[idx] if idx < len(values) else ""
            stats[hdr["key"]] = coerce_value(val)

        item = {
            "player_name": player_name,
            "source_player_id": player_source_id,
            "player_side": player_side,
            "lineup_status": lineup_status,
            "position_code": stats.get("position") if "position" in stats else None,
            "stats": stats
        }

        is_total_row = player_name.lower() == "total" or "opta-total" in row_class
        if is_total_row:
            totals = item
        else:
            rows.append(item)

    return {"headers": headers, "row_count": len(rows), "rows": rows, "totals": totals}


def get_team_tab_titles(driver):
    tab_links = driver.find_elements(By.CSS_SELECTOR, "#opta-player-stats-container ul.Opta-Cf > li > a")
    titles = []
    seen = set()
    for a in tab_links:
        txt = element_text(a)
        if not txt:
            continue
        if txt in {"MATCH SUMMARY", "OPTA POINTS", "MATCH DETAILS"}:
            continue
        if txt not in seen:
            seen.add(txt)
            titles.append(txt)
    return titles


def click_team_tab(driver, title: str):
    links = driver.find_elements(By.CSS_SELECTOR, "#opta-player-stats-container ul.Opta-Cf > li > a")
    for link in links:
        if element_text(link) == title:
            driver.execute_script("arguments[0].click();", link)
            time.sleep(1.0)
            return
    raise ValueError(f"Takım sekmesi bulunamadı: {title}")


def map_team_source_id(section_title: str, match_info: dict):
    if section_title == "All":
        return None
    if section_title == match_info["home_team"]["name"]:
        return match_info["home_team"]["source_team_id"]
    if section_title == match_info["away_team"]["name"]:
        return match_info["away_team"]["source_team_id"]
    return None


def click_stats_mode_if_exists(driver):
    buttons = driver.find_elements(By.CSS_SELECTOR, "#opta-player-stats-container button, #opta-player-stats-container a")
    for el in buttons:
        if element_text(el).strip().lower() == "stats":
            driver.execute_script("arguments[0].click();", el)
            time.sleep(1.0)
            return True
    return False


def parse_match_summary_page(driver):
    match_info = extract_match_info(driver, "match-summary")
    titles = get_team_tab_titles(driver)
    if not titles:
        raise ValueError("Match Summary takım sekmeleri bulunamadı.")
    sections = []
    for title in titles:
        click_team_tab(driver, title)
        table = get_visible_main_table(driver)
        sections.append({
            "section_title": title,
            "team_source_id": map_team_source_id(title, match_info),
            "table": parse_generic_table(table)
        })
    return {"match_info": match_info, "incidents": {"home": [], "away": [], "timeline": []}, "player_stats_sections": sections}


def parse_opta_points_stats_page(driver):
    match_info = extract_match_info(driver, "opta-points-stats")
    click_stats_mode_if_exists(driver)
    titles = get_team_tab_titles(driver)
    if not titles:
        raise ValueError("Opta Points takım sekmeleri bulunamadı.")
    sections = []
    for title in titles:
        click_team_tab(driver, title)
        click_stats_mode_if_exists(driver)
        table = get_visible_main_table(driver)
        sections.append({
            "section_title": title,
            "team_source_id": map_team_source_id(title, match_info),
            "active_mode": "stats",
            "table": parse_generic_table(table)
        })
    return {"match_info": match_info, "stats_sections": sections}


def parse_match_details_page(driver):
    match_info = extract_match_info(driver, "match-details")
    titles = get_team_tab_titles(driver)
    if not titles:
        raise ValueError("Match Details takım sekmeleri bulunamadı.")
    sections = []
    for title in titles:
        click_team_tab(driver, title)
        table = get_visible_main_table(driver)
        sections.append({
            "section_title": title,
            "team_source_id": map_team_source_id(title, match_info),
            "table": parse_generic_table(table)
        })
    return {"match_info": match_info, "details_sections": sections}


def collect_page(driver, url: str, page_type: str, cookie_state: dict):
    driver.get(url)
    wait_for_page(driver)
    accept_cookies_once(driver, cookie_state)

    if not wait_for_current_layout(driver, timeout=6):
        return build_page_result("missing_data", page_type, url, reason=f"{page_type} widget bulunamadı. Muhtemelen no-data maç.")
    if not current_layout_present(driver):
        return build_page_result("missing_data", page_type, url, reason=f"{page_type} layout bulunamadı. Muhtemelen no-data maç.")

    try:
        if page_type == "match-summary":
            data = parse_match_summary_page(driver)
        elif page_type == "opta-points-stats":
            data = parse_opta_points_stats_page(driver)
        else:
            data = parse_match_details_page(driver)
        return build_page_result("ok", page_type, url, data=data)
    except Exception as e:
        return build_page_result("error", page_type, url, reason=f"{page_type} parse sırasında hata oluştu.", error_message=str(e))


def save_json(data, path: Path):
    ensure_dir(path.parent)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_urls_from_csv(csv_path: Path):
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV bulunamadı: {csv_path}")
    urls = []
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if "url" not in reader.fieldnames:
            raise ValueError("CSV içinde 'url' kolonu olmalı.")
        for row in reader:
            url = (row.get("url") or "").strip()
            if url:
                urls.append(url)
    return urls


def build_match_summary_print(result):
    normalized = result["normalized_urls"]
    ms = result["match_summary"]
    op = result["opta_points_stats"]
    md = result["match_details"]

    lines = []
    lines.append("")
    lines.append("========== MAÇ ÖZETİ ==========")
    lines.append(f"Input URL: {result['input_url']}")
    lines.append(f"Match ID: {normalized['source_match_id']}")
    lines.append(f"Season slug: {normalized['source_season_slug']}")

    match_info = None
    for page in [ms, op, md]:
        if page["status"] == "ok" and page["data"] and "match_info" in page["data"]:
            match_info = page["data"]["match_info"]
            break

    if match_info:
        lines.append(f"Maç: {match_info['home_team']['name']} - {match_info['away_team']['name']}")
        lines.append(f"Skor: {match_info['home_team']['score']} - {match_info['away_team']['score']}")
        lines.append(f"Competition: {match_info['competition']}")
        lines.append(f"Date: {match_info['match_date_text']}")
    else:
        lines.append("Maç bilgisi: alınamadı")

    lines.append(f"Match Summary: {ms['status']}" + (f" | reason={ms['reason']}" if ms["reason"] else ""))
    lines.append(f"Opta Points Stats: {op['status']}" + (f" | reason={op['reason']}" if op["reason"] else ""))
    lines.append(f"Match Details: {md['status']}" + (f" | reason={md['reason']}" if md["reason"] else ""))

    if ms["status"] == "ok":
        lines.append(f"Summary sections: {len(ms['data'].get('player_stats_sections', []))}")
    if op["status"] == "ok":
        lines.append(f"Opta Points Stats sections: {len(op['data'].get('stats_sections', []))}")
    if md["status"] == "ok":
        lines.append(f"Match Details sections: {len(md['data'].get('details_sections', []))}")

    print("\n".join(lines))


def process_single_match(driver, input_url: str, cookie_state: dict, output_dir: Path):
    urls = normalize_match_urls(input_url)
    match_id = urls["source_match_id"]
    season_slug = urls["source_season_slug"]

    logging.info(f"İşleniyor: {match_id}")

    if TARGET_SEASON_TOKEN and TARGET_SEASON_TOKEN not in season_slug:
        result = {
            "input_url": input_url,
            "normalized_urls": urls,
            "match_summary": build_page_result("skipped", "match-summary", urls["match_summary_url"], reason=f"Bu script sadece {TARGET_SEASON_TOKEN} sezon DOM'u için aktif."),
            "opta_points_stats": build_page_result("skipped", "opta-points-stats", urls["opta_points_url"], reason=f"Bu script sadece {TARGET_SEASON_TOKEN} sezon DOM'u için aktif."),
            "match_details": build_page_result("skipped", "match-details", urls["match_details_url"], reason=f"Bu script sadece {TARGET_SEASON_TOKEN} sezon DOM'u için aktif."),
        }
        save_json(result, output_dir / f"{match_id}.json")
        logging.info(f"Maç JSON kaydedildi: {output_dir / f'{match_id}.json'}")
        return result

    match_summary_result = collect_page(driver, urls["match_summary_url"], "match-summary", cookie_state)
    opta_points_result = collect_page(driver, urls["opta_points_url"], "opta-points-stats", cookie_state)
    match_details_result = collect_page(driver, urls["match_details_url"], "match-details", cookie_state)

    result = {
        "input_url": input_url,
        "normalized_urls": urls,
        "match_summary": match_summary_result,
        "opta_points_stats": opta_points_result,
        "match_details": match_details_result,
    }

    save_json(result, output_dir / f"{match_id}.json")
    logging.info(f"Maç JSON kaydedildi: {output_dir / f'{match_id}.json'}")
    return result


def main():
    ensure_dir(DATA_DIR)
    logging.info(f"CSV bulundu: {CSV_PATH}")
    urls = load_urls_from_csv(CSV_PATH)
    logging.info(f"İşlenecek maç sayısı: {len(urls)}")

    driver = setup_driver()
    cookie_state = {"done": False}
    results = []

    try:
        for idx, input_url in enumerate(urls, start=1):
            logging.info(f"{idx}/{len(urls)} başladı")
            try:
                result = process_single_match(driver, input_url, cookie_state, DATA_DIR)
                results.append(result)
                build_match_summary_print(result)
            except Exception as e:
                logging.exception(f"Bu maç işlenirken hata oluştu: {input_url} | {e}")
                fallback_urls = normalize_match_urls(input_url)
                results.append({
                    "input_url": input_url,
                    "normalized_urls": fallback_urls,
                    "match_summary": build_page_result("error", "match-summary", fallback_urls["match_summary_url"], reason="Genel akış hatası", error_message=str(e)),
                    "opta_points_stats": build_page_result("error", "opta-points-stats", fallback_urls["opta_points_url"], reason="Genel akış hatası", error_message=str(e)),
                    "match_details": build_page_result("error", "match-details", fallback_urls["match_details_url"], reason="Genel akış hatası", error_message=str(e)),
                })

        save_json(results, DATA_DIR / "all_matches.json")
        logging.info(f"Tüm maçlar kaydedildi: {DATA_DIR / 'all_matches.json'}")
        logging.info("Tüm akış tamamlandı.")
    finally:
        if KEEP_BROWSER_OPEN:
            input("\nTarayıcı açık bırakıldı. Kapatmak için Enter'a bas...")
        driver.quit()


if __name__ == "__main__":
    main()
